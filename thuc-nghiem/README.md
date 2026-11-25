# Nghiên cứu SQLi bậc hai với MySQL

Ứng dụng HTTP cục bộ lưu một bộ lọc danh mục rồi sử dụng lại dữ liệu đã lưu khi xem trước và xuất danh mục. Bộ lọc có nhóm sản phẩm, thứ tự sắp xếp và trần giá tùy chọn. Người dùng công bố bộ lọc để mở thao tác xuất. Thiết kế này cho phép theo dõi từng giá trị đi từ yêu cầu ghi đến các vị trí SQL đọc lại.

Để giao cho AI thực hiện và lưu hồ sơ cho từng câu hỏi, dùng `thực hiện nghiên cứu RQ1`, `thực hiện nghiên cứu RQ2` hoặc `thực hiện nghiên cứu RQ3` từ thư mục gốc. Xem [quy trình nghiên cứu](nghien-cuu/README.md) để biết tiêu chí đo và đầu ra.

## Chạy thí nghiệm

Yêu cầu Node.js từ 22.9.0 và MySQL 8.0.46. Có thể dùng Docker Compose để dựng MySQL hoặc kết nối đến MySQL đã có. Thực hiện các lệnh từ thư mục `thuc-nghiem`.

```powershell
Copy-Item .env.example .env
```

Điền hai mật khẩu riêng cho `MYSQL_PASSWORD` và `MYSQL_ROOT_PASSWORD` trong `.env`. Cổng MySQL mặc định của bộ thí nghiệm là 3307.

```powershell
npm.cmd ci
docker compose up -d --wait
npm.cmd run init
npm.cmd test
npm.cmd run study
```

Trên macOS hoặc Linux, dùng `cp .env.example .env` và `npm`. Nếu đã có MySQL, tạo schema riêng theo `MYSQL_DATABASE`, cấp `SELECT, INSERT, UPDATE, DELETE, CREATE` trên schema đó cho tài khoản ứng dụng và điền cổng cùng thông tin đăng nhập vào `.env`. Khi dùng MySQL đã có, bỏ qua lệnh Docker. Lệnh `init` tạo hai bảng và bốn sản phẩm mẫu. Có thể chạy `init` lại với cùng schema.

Mỗi lượt chạy in đường dẫn đến `report.md` và `report.json` trong một thư mục mới dưới `results/`. Dùng `npm.cmd run study -- --out ten-thu-muc` để chọn thư mục đích.

## Chạy thử API

Chạy `npm.cmd start` trong một cửa sổ. API lắng nghe ở `127.0.0.1:8080` theo mặc định. Trong cửa sổ PowerShell khác, thực hiện một luồng hoàn chỉnh.

```powershell
$id = [guid]::NewGuid().ToString()
$url = "http://127.0.0.1:8080/searches/$id"
$json = @{category = "Đồ của O'Brien"; sort = 'price'; ceiling = 250000} | ConvertTo-Json
$body = [Text.Encoding]::UTF8.GetBytes($json)
Invoke-RestMethod $url -Method Put -ContentType 'application/json; charset=utf-8' -Body $body
Invoke-RestMethod $url
(Invoke-RestMethod "$url/preview").items
Invoke-RestMethod "$url/publish" -Method Post
(Invoke-RestMethod "$url/export").items
```

| Yêu cầu | Kết quả |
| --- | --- |
| `PUT /searches/:id` | Lưu bộ lọc mới ở trạng thái `draft` và trả HTTP 201. |
| `GET /searches/:id` | Đọc lại bộ lọc từ MySQL. |
| `GET /searches/:id/preview` | Đọc lại bộ lọc và trả sản phẩm phù hợp. |
| `POST /searches/:id/publish` | Chuyển bản nháp sang `published`. |
| `GET /searches/:id/export` | Xuất danh mục JSON. Bản nháp nhận HTTP 409. |

`:id` là UUID v4 viết thường. `category` dài từ 1 đến 64 ký tự và phải có nội dung. `sort` nhận `name` hoặc `price`. `ceiling` nhận số nguyên từ 0 đến 100.000.000 đồng, hoặc `null` để bỏ giới hạn. Có thể bỏ qua trường `ceiling`.

## Thiết kế nghiên cứu

### RQ1 · Cơ chế

`SAVE_SEARCH` ghi các giá trị qua tham số. `LOAD_SEARCH` lấy bản ghi từ MySQL. Ở bước tái sử dụng, `category` là tham số lọc và `sort` chọn một trong hai mẫu sắp xếp cố định. `ceiling` quyết định nhánh xem trước và trở thành tham số lọc giá khi áp dụng. `state` do ứng dụng quản lý và quyết định có chạy truy vấn xuất hay không. Danh mục SQL và các vai trò của từng trường nằm trong [src/statements.js](src/statements.js).

### RQ2 · Kiểm soát phòng thủ

Đơn vị đếm là vị trí tạo SQL, gộp các lần gọi và biến thể của cùng vị trí. Một vị trí vi phạm tiêu chí khi có ít nhất một ô giá trị đọc lại từ bản ghi được xử lý ngoài ràng buộc tham số. Mô hình đối chứng đánh dấu các ô này là không ràng buộc trên đúng dấu vết của cùng một luồng. Luồng nghiệp vụ, ràng buộc ID của yêu cầu hiện tại và lựa chọn mẫu SQL được giữ giống nhau. MySQL chỉ thực thi cấu hình có ràng buộc đầy đủ. Kết quả RQ2 là phép so sánh theo tiêu chí đã định nghĩa, với danh sách từng ô tham số trong báo cáo.

Prepared statement ràng buộc các giá trị. Hai mẫu `ORDER BY` sử dụng các định danh cố định đã khai báo trong mã. [MySQL PREPARE](https://dev.mysql.com/doc/refman/8.0/en/prepare.html) · [mysql2 prepared statements](https://sidorares.github.io/node-mysql2/docs/documentation/prepared-statements)

### RQ3 · Độ bao phủ

Mỗi nhóm gửi 20 yêu cầu HTTP thật qua cùng các trình xử lý. Năm thao tác được lặp lại trên bốn ca kết hợp hai kiểu sắp xếp và hai giá trị trần giá. Mỗi yêu cầu dùng một kết nối MySQL với autocommit. Kịch bản kiểm tra mã HTTP, dữ liệu đọc lại, ID và thứ tự sản phẩm cũng như đường đi SQL. Các nhóm dùng mã bộ lọc riêng. Chương trình dọn các bản ghi mà mỗi nhóm đã tạo.

| Nhóm | Chuẩn bị dữ liệu | Vị trí đo được | Biến thể đo được |
| --- | --- | ---: | ---: |
| Chuỗi | Năm thao tác theo thứ tự trên cùng một bản ghi | 3/3 | 6/6 |
| Fixture khớp trạng thái | Mỗi yêu cầu độc lập. Yêu cầu xuất có fixture đã công bố | 3/3 | 6/6 |
| Fixture nháp | Mỗi yêu cầu độc lập. Yêu cầu xuất có bản ghi nháp hợp lệ nhưng chưa đủ điều kiện xuất | 2/3 | 4/6 |

Mẫu số lấy từ ba vị trí tái sử dụng trong danh mục SQL, mỗi vị trí có hai biến thể sắp xếp. Một vị trí được bao phủ khi truy vấn thành công ít nhất một lần, kể cả khi kết quả rỗng. SQL chuẩn bị fixture, khởi tạo bảng và dọn bản ghi nằm ngoài phép đo. Yêu cầu xuất từ fixture nháp đọc được bản ghi, dừng ở điều kiện `state = published` và trả HTTP 409. Cả hai nhánh xem trước đạt độ bao phủ trong cả ba nhóm do các ca giá giống nhau.

## Đọc bằng chứng

- `report.md` trình bày kết quả cho cả ba RQ. Trên MySQL 8.0.46, phép so sánh RQ2 cho kết quả 3 → 0 tại `PREVIEW_CATEGORY`, `PREVIEW_BUDGET` và `EXPORT_SEARCH`.
- `report.json` ghi cấu hình phiên bản, danh mục mẫu SQL, danh sách yêu cầu, mã phản hồi, thứ tự sự kiện SQL và quyết định nhánh. Ghép từng sự kiện với yêu cầu qua `requestId`. `startingState` mô tả trạng thái dự kiến của ca. Sự kiện `export_requires_published` ghi lại trạng thái mà trình xử lý thực sự đọc.
- `npm test` kiểm tra danh mục và ràng buộc tham số, so sánh theo vị trí và loại bỏ đầu vào sai trước bước truy vấn. `npm run study` kiểm tra tích hợp trên MySQL và thực thi đủ 60 yêu cầu.

Kết quả áp dụng cho chức năng và trạng thái đã khảo sát. Phép đối chứng fixture khớp trạng thái cho thấy chuỗi và yêu cầu độc lập có cùng độ bao phủ khi fixture thỏa tiền điều kiện nghiệp vụ.
