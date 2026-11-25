# RQ2 · Kiểm soát phòng thủ

## Câu hỏi và câu trả lời

> Khi giữ nguyên luồng nghiệp vụ và quy tắc chọn cấu trúc SQL, việc mở rộng ràng buộc tham số từ bước ghi sang các bước tái sử dụng làm thay đổi số lượng và danh sách vị trí vi phạm tiêu chí tách dữ liệu khỏi cấu trúc SQL như thế nào?

**Hoàn tất.** Số vị trí vi phạm giảm từ **3/3 trong mô hình A** xuống **0/3 trong thực thi B**. Ba vị trí thay đổi gồm `PREVIEW_CATEGORY`, `PREVIEW_BUDGET` và `EXPORT_SEARCH`. Phép đo dùng cùng dấu vết của 20 yêu cầu `chain` trên MySQL. [Bảng bằng chứng](bang-chung.csv)

## Thiết kế và môi trường

- Đơn vị phân tích là `site`. Một vị trí được đếm một lần nếu có ít nhất một ô giá trị đọc lại từ bản ghi được xử lý ngoài ràng buộc, gộp qua mọi lần gọi và biến thể. Mẫu số là ba vị trí tái sử dụng trong danh mục, cả ba đều quan sát được. [Kế hoạch](ke-hoach.md)
- Hai chính sách dùng cùng luồng ghi → đọc → xem trước → công bố → xuất, cùng bản ghi của mỗi ca, ràng buộc ID yêu cầu và quy tắc chọn cấu trúc. A gán nhãn `unbound` cho mỗi ô `source = stored` trên dấu vết B. B lấy `treatment` từ sự kiện SQL sau khi thao tác với MySQL thành công. Bộ tích hợp dùng dữ liệu tổng hợp, hai lựa chọn `sort` (`name`, `price`) và hai giá trị `ceiling` (`null`, 250.000 đồng). [Thiết kế RQ2](../../../rq2.md) · [Bộ chạy](../../../../src/study.js)
- Đợt `20261125-210226-rang-buoc`, SHA `6c25acb4c0d54b62da4685a193512b9c52ebd775`. Kết quả `git status --short` khi bắt đầu rỗng. Mã ứng dụng và bộ chạy dùng đúng phiên bản tại SHA. Lượt chính `run-BX1Q5w` được ghi lúc **21:06:01.831 ngày 25/11/2026 (UTC+07:00)**, tương ứng `2026-11-25T14:06:01.831Z`. Node.js `v24.21.0`, npm `11.19.0`, MySQL Community Server `8.0.46` và mysql2 `3.24.6`. HTTP nghe trên `127.0.0.1` với cổng động. MySQL dùng `127.0.0.1:57181`, schema riêng `sqli_study_rq2`, `utf8mb4`, autocommit bật và `multipleStatements: false`. Cấu hình kết nối được truyền qua môi trường của lượt chạy. [Nhật ký phiên](nhat-ky/phien-chay.txt) · [Kết nối ứng dụng](../../../../src/database.js) · [Dữ liệu gốc JSON](du-lieu-goc/run-BX1Q5w/report.json) · [Tổng hợp CLI](du-lieu-goc/run-BX1Q5w/report.md#rq2--mở-rộng-ràng-buộc-tham-số)

| Lệnh từ `thuc-nghiem/` | Mã thoát | Kết quả |
| --- | ---: | --- |
| `npm.cmd test` | 0 | 4/4 kiểm thử đạt. [Nhật ký](nhat-ky/npm-test.txt) |
| `npm.cmd run init` | 0 | Khởi tạo bảng và danh mục mẫu. [Nhật ký](nhat-ky/npm-init.txt) |
| `npm.cmd run study -- --out nghien-cuu/ket-qua/RQ2/20261125-210226-rang-buoc/du-lieu-goc` | 0 | 60 yêu cầu HTTP qua ba nhóm, gồm 20 yêu cầu thuộc `chain`. Bộ chạy kiểm tra mã HTTP, dữ liệu đọc lại, ID và thứ tự sản phẩm, cùng đường đi SQL. [Nhật ký](nhat-ky/npm-study.txt) |

Kiểm tra sau khi chạy ghi nhận bốn sản phẩm mẫu và không còn bản ghi bộ lọc do bộ chạy tạo. Phiên MySQL riêng đã tắt và thư mục dữ liệu tạm đã được dọn. [Nhật ký phiên](nhat-ky/phien-chay.txt)

## Kết quả và bằng chứng

| Chính sách | Nguồn bằng chứng | Số vị trí vi phạm | Tập ID |
| --- | --- | ---: | --- |
| A · Chỉ ràng buộc khi ghi (mô hình) | Gán lại nhãn trên dấu vết `chain` theo `metadata_counterfactual` | 3/3 | `PREVIEW_CATEGORY`, `PREVIEW_BUDGET`, `EXPORT_SEARCH` |
| B · Ràng buộc khi ghi và tái sử dụng (thực thi) | Đọc nhãn ô từ các sự kiện SQL đã thực thi trên MySQL | 0/3 | ∅ |

**Mức giảm `|A| − |B|` là 3 vị trí.** Hiệu `A ∖ B` gồm cả ba vị trí trong hàng A. Hiệu `B ∖ A` là tập rỗng.

| Vị trí | Ô | Trường từ bản ghi | A · Mô hình | B · Thực thi | Số lần gọi `name` / `price` | Mã bằng chứng |
| --- | ---: | --- | --- | --- | ---: | --- |
| `PREVIEW_CATEGORY` | 1 | `category` | `unbound` | `bound` | 1 / 1 | `RQ2-PREVIEW_CATEGORY-1` |
| `PREVIEW_BUDGET` | 1 | `category` | `unbound` | `bound` | 1 / 1 | `RQ2-PREVIEW_BUDGET-1` |
| `PREVIEW_BUDGET` | 2 | `ceiling` | `unbound` | `bound` | 1 / 1 | `RQ2-PREVIEW_BUDGET-2` |
| `EXPORT_SEARCH` | 1 | `category` | `unbound` | `bound` | 2 / 2 | `RQ2-EXPORT_SEARCH-1` |
| `EXPORT_SEARCH` | 2 | `ceiling` | `unbound` | `bound` | 2 / 2 | `RQ2-EXPORT_SEARCH-2` |
| `EXPORT_SEARCH` | 3 | `ceiling` | `unbound` | `bound` | 2 / 2 | `RQ2-EXPORT_SEARCH-3` |

Trong nhóm `chain`, bốn yêu cầu xem trước đi qua hai nhánh và bốn yêu cầu xuất đều có quyết định `export_requires_published` với `state = published`, `allowed = true`. `sort` chọn một trong hai mẫu `ORDER BY` đã khai báo. `ceiling = null` chọn `PREVIEW_CATEGORY`, còn trần giá 250.000 đồng chọn `PREVIEW_BUDGET`. Mẫu xuất có hai ô riêng cho `ceiling`, dùng lần lượt cho điều kiện `IS NULL` và điều kiện so sánh giá. Ví dụ ở ca `price-budget`, yêu cầu xuất `89dbcc7e-8132-458a-a4e2-4cbcada04ce0` ghi quyết định tại `trace[1]` và truy vấn `EXPORT_SEARCH/price` tại `trace[2]`. [Bảng bằng chứng](bang-chung.csv) · [Trình xử lý](../../../../src/app.js#L63) · [Danh mục SQL](../../../../src/statements.js#L38)

## Kiểm chứng và sai lệch

- Duyệt toàn bộ sự kiện `type = sql` của `runs[]` với `suite = chain`. Ghép với `runs[].requests[]` theo yêu cầu chứa `requestId` và dùng chỉ số `trace[]` từ 0. Thu được 28 sự kiện SQL trên sáu vị trí nghiệp vụ. Tám sự kiện tái sử dụng bao phủ **3/3 vị trí và 6/6 biến thể** trong danh mục. `SAVE_SEARCH`, `LOAD_SEARCH` và `PUBLISH_SEARCH` cũng được quan sát, với các ô có nguồn `request`.
- Đối chiếu mẫu, thứ tự ô, nguồn và `selectors` của từng sự kiện với danh mục trong dữ liệu gốc và mã hiện hành. Sau khi lọc `source = stored`, gộp các lần xuất hiện theo `site` để đếm và theo `(site, slot)` để chẩn đoán. `bang-chung.csv` lưu 50 dòng, gồm 18 lần xuất hiện ô `stored` và 32 lần xuất hiện ô `request`. Mỗi mã bằng chứng nhận diện một cặp `(site, slot)` và lặp lại ở các lần gọi tương ứng. Cột `source_ref` dẫn tới ô bằng JSON Pointer. Với ô `request`, cột mô hình dùng cùng nhãn với thực thi.
- Bộ tổng hợp CLI lấy sự kiện SQL đầu tiên theo `site`. Danh sách ô, nguồn và nhãn của sự kiện đầu tiên khớp mọi lần gọi còn lại ở từng vị trí. Kết quả tính từ toàn bộ dấu vết khớp `rq2.method`, `rq2.observedSites`, `rq2.sites`, hai tập vi phạm, mức giảm và bảng Markdown. Cả ba vị trí tái sử dụng đều có bằng chứng thực thi. [Mã tổng hợp](../../../../src/report.js#L13) · [Nhật ký tính lại](nhat-ky/kiem-chung.txt) · [Bảng bằng chứng](bang-chung.csv)
- Lần chuẩn bị đầu chưa xác nhận được kết nối MySQL đã xác thực và dừng trước khi chạy tích hợp. Lần chạy chính dùng tài khoản kiểm tra qua TCP loopback riêng, xác nhận phiên bản và schema trước khi khởi tạo. Thư mục MySQL tạm của cả hai lần đã được dọn. Mọi kết quả trên lấy từ lượt mới `run-BX1Q5w`. [Nhật ký lần chuẩn bị đầu](nhat-ky/phien-chay-lan-dau.txt) · [Nhật ký lượt chính](nhat-ky/phien-chay.txt)

Để tính lại bảng CSV, thống kê và hình, chạy lệnh sau từ thư mục hồ sơ. [Mã kiểm chứng](kiem-chung.mjs)

```powershell
node .\kiem-chung.mjs .\du-lieu-goc\run-BX1Q5w
```

## Diễn giải và giới hạn

Mức giảm ba vị trí đến từ giả định của A gán nhãn ngoài ràng buộc cho mọi ô giá trị đã đọc lại. Ở B, ứng dụng lấy giá trị theo thứ tự của danh mục, chọn mẫu đã đăng ký và gửi mẫu cùng mảng tham số qua `connection.execute(template, params)`. MySQL cho phép dấu `?` ở vị trí giá trị. Mã ứng dụng dùng các mẫu cố định cho hai lựa chọn sắp xếp và kiểm tra trạng thái xuất ở trình xử lý. [Vị trí gọi driver](../../../../src/statements.js#L60) · [MySQL PREPARE](https://dev.mysql.com/doc/refman/8.0/en/prepare.html) · [mysql2 Prepared Statements](https://sidorares.github.io/node-mysql2/docs/documentation/prepared-statements)

Kết luận giới hạn ở tiêu chí tách giá trị khỏi cấu trúc tại ba vị trí quan sát được, với bộ ca và trạng thái nghiệp vụ đã nêu. Bằng chứng B đến từ siêu dữ liệu phía ứng dụng tại điểm gọi driver, sau khi MySQL trả kết quả. Bằng chứng A là phép gán nhãn trên dấu vết đó. Mức chênh lệch định lượng tác động của quy tắc phân loại trên bộ ca này.

## Hình và đoạn trích cho tiểu luận

**Chú thích hình.** Số vị trí tái sử dụng vi phạm tiêu chí tách dữ liệu khỏi cấu trúc SQL trong nhóm `chain`. Mô hình A có 3/3 vị trí và thực thi B có 0/3 vị trí. Đơn vị là vị trí SQL duy nhất, gộp mọi lần gọi và biến thể. Nguồn là các sự kiện SQL của nhóm `chain` trong dữ liệu gốc. [Hình SVG](hinh/rq2-vi-tri-vi-pham.svg) · [Dữ liệu gốc](du-lieu-goc/run-BX1Q5w/report.json)

> Trên 20 yêu cầu của nhóm chuỗi, cả ba vị trí tái sử dụng đều xuất hiện với hai biến thể sắp xếp. Mô hình chỉ ràng buộc khi ghi đánh dấu ba vị trí vi phạm khi giả định mọi ô giá trị đọc lại đều ngoài ràng buộc. Dấu vết thực thi trên MySQL 8.0.46 ghi nhận cả ba vị trí ràng buộc đầy đủ các ô đọc lại, gồm hai ô trần giá riêng tại vị trí xuất. Chênh lệch ba vị trí mô tả tiêu chí tách dữ liệu khỏi cấu trúc SQL tại các vị trí đã quan sát.

## Kiểm tra trước khi bàn giao

- [x] Câu trả lời nêu số lượng, tập vị trí, mức giảm và bằng chứng theo ô.
- [x] Tính lại từ toàn bộ dấu vết và đối chiếu với số liệu CLI, CSV và hình.
- [x] Hồ sơ có liên kết tương đối, lệnh tái lập và phạm vi kết luận.
- [x] Kiểm tra chữ, trục và chú thích hình ở kích thước slide.

