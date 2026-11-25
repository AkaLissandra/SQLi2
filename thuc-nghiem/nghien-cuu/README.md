# Quy trình nghiên cứu SQLi bậc hai với MySQL

Từ thư mục gốc của repo, giao cho AI `thực hiện nghiên cứu RQ1`, `thực hiện nghiên cứu RQ2` hoặc `thực hiện nghiên cứu RQ3`. [Chỉ dẫn cấp repo](../../AGENTS.md) trỏ đến quy trình này. Mỗi yêu cầu tạo một hồ sơ thực nghiệm để tra lại số liệu và viết tiểu luận hoặc làm slide.

| Câu hỏi | Thiết kế và đầu ra chính |
| --- | --- |
| RQ1 · Cơ chế | [Bản đồ từ trường đã lưu đến vị trí SQL và vai trò của trường](rq1.md) |
| RQ2 · Kiểm soát phòng thủ | [So sánh theo tiêu chí tách giá trị và cấu trúc SQL](rq2.md) |
| RQ3 · So sánh độ bao phủ | [Đối chiếu hai cách kiểm thử và phân tích điều kiện trạng thái](rq3.md) |

Các lượt dùng chung [mẫu báo cáo](mau-bao-cao.md). Sơ đồ luồng dữ liệu có bản [SVG](hinh/luong-du-lieu.svg) và [PNG 2880 × 1620](hinh/luong-du-lieu.png) để chèn vào tiểu luận hoặc slide.

*Chú thích hình gợi ý. Bộ lọc được ghi vào MySQL, sau đó được đọc lại để xem trước hoặc xuất danh mục. Sơ đồ chỉ ra các ô giá trị ràng buộc, lựa chọn mẫu và điều kiện thực thi theo thiết kế trong mã ứng dụng.*

## Phạm vi và cách đọc bằng chứng

Nghiên cứu ứng dụng HTTP cục bộ lưu bộ lọc danh mục trong MySQL, đọc lại và dùng bộ lọc để xem trước hoặc xuất danh mục. Dùng dữ liệu tổng hợp hợp lệ và schema riêng cho nghiên cứu. Các truy vấn nghiệp vụ thực thi với `mysql2` qua `connection.execute(mẫu, tham_số)`.

| Tệp | Vai trò trong thực nghiệm |
| --- | --- |
| [README ứng dụng](../README.md) | Cài đặt, khởi tạo MySQL, hợp đồng API và mô tả bộ thí nghiệm |
| [app.js](../src/app.js) | Nguồn dữ liệu, các trình xử lý HTTP và quyết định nhánh |
| [statements.js](../src/statements.js) | Danh mục vị trí, biến thể, ô giá trị và hàm gọi MySQL |
| [database.js](../src/database.js) | Kết nối, schema, dữ liệu mẫu và autocommit |
| [study.js](../src/study.js) | Ca kiểm thử, fixture, các nhóm, kiểm tra kết quả HTTP và ghi báo cáo |
| [report.js](../src/report.js) | Quy tắc tổng hợp RQ1, RQ2 và RQ3 |
| [study.test.js](../test/study.test.js) | Kiểm thử danh mục, cách truyền tham số và điều kiện đầu vào |

- **Vị trí SQL** là mã ổn định `site` đại diện cho một vai trò truy vấn. **Biến thể** là cặp `(site, variant)` nhận diện một mẫu SQL trong vị trí đó. **Ô tham số** là thứ tự `slot` từ 1 trong mẫu của vị trí.
- **Danh mục từ mã** xác định trường hợp có thể xảy ra và mẫu số độ bao phủ. Xác nhận vai trò truy vấn bằng cả trình xử lý và danh mục SQL.
- **Dấu vết thực thi** được bộ quan sát của ứng dụng ghi theo thứ tự trong từng HTTP request. Ghép `runs[].requests[]` với `trace[]` qua bản ghi yêu cầu chứa `requestId`. Với `type: sql`, sự kiện được phát sau khi MySQL trả kết quả qua driver. Lần thực thi trả 0 dòng vẫn được quan sát. Với `type: decision`, đọc quyết định nhánh từ ứng dụng.
- **Mô hình đối chiếu RQ2** tính lại nhãn ràng buộc theo một chính sách giả định trên cùng dấu vết. Cột kết quả từ mô hình và cột từ thực thi cần được ghi tên rõ trong bảng, hình và kết luận.
- Dấu vết SQL lưu siêu dữ liệu về ô tham số, nguồn và cách xử lý. Dùng kết quả kiểm thử trong `study.js` để xác nhận dữ liệu đọc lại và thứ tự sản phẩm. Giới hạn suy luận của phép đo ở ranh giới gọi driver và các chức năng đã khảo sát.

## Thực hiện một RQ

1. **Chốt thiết kế trước khi chạy.** Đọc RQ được giao và đối chiếu với phiên bản mã hiện tại. Ghi `ke-hoach.md` với phạm vi, đơn vị phân tích, điều kiện hoặc nhóm, đầu vào, tiêu chí quan sát, giả thuyết có thể kiểm tra và sai lệch đã biết. Ghi SHA từ `git rev-parse HEAD` và trạng thái từ `git status --short` khi bắt đầu. Nếu mã ảnh hưởng đến phép đo có sửa cục bộ, ghi các tệp và thay đổi liên quan để người đọc tái lập được.
2. **Chuẩn bị môi trường.** Làm theo [hướng dẫn cài đặt](../README.md). Tái sử dụng cài đặt phù hợp và xác nhận đích kết nối là schema dành cho nghiên cứu. Dùng cấu hình hiện có nếu phù hợp. Nếu cần `.env` mới, bắt đầu từ `.env.example`. Ghi phiên bản thực tế của Node.js, MySQL và `mysql2`, lệnh đã dùng, cấu hình ảnh hưởng đến phép đo và thời điểm chạy kèm múi giờ. Loại mật khẩu và dữ liệu định danh ra khỏi hồ sơ.
3. **Chạy kiểm thử và lượt tích hợp.** Chạy `npm.cmd test` từ `thuc-nghiem/` trên Windows, rồi chạy lệnh bên dưới. Trên macOS và Linux dùng `npm`. Lưu lệnh, mã thoát và kết quả kiểm thử. Một lượt tích hợp hiện chạy HTTP thật qua các trình xử lý, kết nối MySQL thật và xuất hai báo cáo cho cả ba RQ. Phân tích sâu RQ được giao.

   ```powershell
   npm.cmd run study -- --out 'nghien-cuu/ket-qua/<RQX>/<ma-dot>/du-lieu-goc'
   ```

   Thay `<RQX>` và `<ma-dot>` trước khi chạy. Đặt mã đợt mới cho mỗi yêu cầu, chẳng hạn `YYYYMMDD-HHmmss-<ma-ngan>`. Bộ chạy tạo thư mục `run-*` bên dưới thư mục đích. Dùng chính đường dẫn do CLI in ra.

4. **Kiểm chứng số liệu.** Đọc `report.json` và tự tính lại bảng chính theo quy tắc của RQ, rồi đối chiếu với `report.md`. Kiểm tra bộ ca và số yêu cầu thực tế, điều kiện nhánh, danh sách vị trí và biến thể. Ghi cách lọc và khóa gộp. Nếu dùng truy vấn dữ liệu hoặc mã để tính lại số liệu, lưu cách chạy đủ để lặp lại. Nếu phát hiện sai lệch, giữ dữ liệu gốc, ghi nguyên nhân và tách rõ mọi lượt chạy bổ sung.
5. **Bàn giao hồ sơ.** Viết báo cáo theo mẫu và lưu bảng bằng chứng, hình cần sử dụng, cùng chú thích. Kiểm tra mọi số có thể truy về dữ liệu gốc, mọi liên kết mở được và mọi tuyên bố khớp mức bằng chứng. Nếu môi trường chặn lượt chạy mới, lưu phần phân tích mã đã thực hiện, bước bị chặn, lệnh và lỗi đã lược thông tin nhạy cảm. Nếu dùng lượt cũ để tham khảo, ghi ngày, nguồn và điều kiện của lượt đó. Dùng trạng thái `Hoàn tất một phần` khi thiếu bằng chứng cần thiết.

## Hồ sơ kết quả

```text
thuc-nghiem/nghien-cuu/ket-qua/RQX/<ma-dot>/
  ke-hoach.md                      Thiết kế và tiêu chí trước khi chạy
  bao-cao.md                       Phương pháp, kết quả, diễn giải và giới hạn
  bang-chung.csv                   Các dòng bằng chứng theo hướng dẫn từng RQ
  du-lieu-goc/run-*/report.json     Dữ liệu gốc do bộ chạy tạo
  du-lieu-goc/run-*/report.md       Bản tổng hợp do bộ chạy tạo
  hinh/                            Hình dùng cho tiểu luận hoặc slide, nếu có
```

Giữ nguyên báo cáo gốc do CLI tạo. Dùng đường dẫn tương đối trong `bao-cao.md`, chỉ rõ lượt nào là lượt chính nếu có nhiều lượt. Ghi CSV bằng UTF-8. Dùng `requestId` khi bằng chứng đến từ một yêu cầu. Nếu một dòng đại diện cho nhiều yêu cầu, ghi điều kiện lọc hoặc dùng nhiều dòng có cùng mã bằng chứng. Trường trống cần có cách diễn giải trong báo cáo.

Lưu sơ đồ hoặc biểu đồ ở dạng có thể chèn vào tài liệu, ưu tiên SVG hoặc PNG đủ độ phân giải. Dùng tên gợi rõ RQ và nội dung. Với hình định lượng, ghi biến, đơn vị, mẫu số, nguồn số liệu và tên từng nhóm hoặc chính sách. Với hình mô tả thiết kế, ghi rõ nó minh họa cấu trúc từ mã. Đọc hình ở kích thước slide để kiểm tra chữ và chú giải. Mỗi hình kèm chú thích có thể dùng trực tiếp trong tiểu luận.

## Tài liệu kỹ thuật

- MySQL mô tả tham số `?` ở vị trí giá trị dữ liệu. Cấu trúc như từ khóa hoặc định danh được xác định trong mẫu SQL. [MySQL 8.0 Reference Manual · PREPARE](https://dev.mysql.com/doc/refman/8.0/en/prepare.html)
- Tài liệu driver mô tả `connection.execute()` và cách truyền danh sách tham số riêng. [mysql2 · Prepared Statements](https://sidorares.github.io/node-mysql2/docs/documentation/prepared-statements)
