# RQ1 · Cơ chế tái sử dụng dữ liệu đã lưu

## Câu hỏi và câu trả lời

> Trong ứng dụng dùng MySQL được khảo sát, dữ liệu do người dùng cung cấp sau khi được ghi và đọc lại đi đến những vị trí tạo SQL nào, và được sử dụng ở đó dưới dạng giá trị tham số hay đầu vào để chọn cấu trúc truy vấn?

**Hoàn tất.** Qua bốn ca nhóm `chain`, dữ liệu bộ lọc đọc lại đi đến `PREVIEW_CATEGORY`, `PREVIEW_BUDGET` và `EXPORT_SEARCH`. Quan sát đủ 3/3 vị trí và 6/6 cặp vị trí–biến thể trong danh mục tái sử dụng. `category` là giá trị ràng buộc ở cả ba vị trí. `sort` chọn biến thể sắp xếp cố định. `ceiling` vừa chọn vị trí xem trước, vừa là giá trị ràng buộc ở nhánh có trần giá và ở truy vấn xuất. `state` do ứng dụng quản lý và quyết định truy vấn xuất có được thực thi. [Bảng bằng chứng](bang-chung.csv)

## Thiết kế và môi trường

Đợt `20261125-205416-truy-vet` theo [kế hoạch đã lưu trước khi chạy](ke-hoach.md). SHA `326acdd58022585971889f55ff50e7bb47b5064c`. Cây làm việc ban đầu sạch theo `git status --short`. Dùng mã và bộ chạy hiện có. Đơn vị phân tích là mỗi trường tại một ô tham số hoặc một quyết định trong một yêu cầu. Danh mục có ba vị trí tái sử dụng và hai biến thể `name` và `price` trên mỗi vị trí. Bộ chạy dùng bốn sản phẩm mẫu và một danh mục mẫu có dấu nháy đơn. Bốn ca phối hợp hai cách sắp xếp với `ceiling` bằng `null` hoặc 250.000 đồng. [Ca và kiểm tra phản hồi](../../../../src/study.js) · [Danh mục SQL](../../../../src/statements.js) · [Schema và dữ liệu mẫu](../../../../src/database.js)

MySQL 8.0.46, Node.js v24.21.0, npm 11.19.0 và mysql2 3.24.6 trên Windows. Lượt chính ghi thời điểm `2026-11-25T20:56:47.867+07:00` theo giờ Việt Nam (`2026-11-25T13:56:47.867Z` trong dữ liệu gốc). Dùng một tiến trình MySQL riêng trên `127.0.0.1:57742` và schema mới `sqli_study_rq1` với `utf8mb4_0900_bin`. Xác nhận đích bằng `VERSION()`, `DATABASE()`, `@@port`, `@@bind_address` và `@@session.autocommit`. API dùng cổng loopback do hệ điều hành cấp. Mỗi yêu cầu sử dụng một kết nối, với `autocommit = 1`, `utf8mb4` và `multipleStatements: false`. Tài khoản ứng dụng được cấp `SELECT, INSERT, UPDATE, DELETE, CREATE` trong schema nghiên cứu. Thiết lập kết nối qua biến môi trường của tiến trình chạy. [Nhật ký môi trường và mã thoát](nhat-ky/phien-chay.txt) · [Cấu hình kết nối](../../../../src/database.js)

| Lệnh từ `thuc-nghiem/` | Mã thoát | Kết quả |
| --- | ---: | --- |
| `npm.cmd test` | 0 | 4 đạt trên 4, gồm kiểm tra danh mục, tham số và điều kiện đầu vào. [Nhật ký kiểm thử](nhat-ky/npm-test.txt) |
| `npm.cmd run init` | 0 | Khởi tạo bảng và danh mục mẫu. [Nhật ký khởi tạo](nhat-ky/npm-init.txt) |
| `npm.cmd run study -- --out nghien-cuu/ket-qua/RQ1/20261125-205416-truy-vet/du-lieu-goc` | 0 | 60 yêu cầu qua HTTP và MySQL, chia đều cho ba nhóm. Sau bộ chạy còn đúng bốn sản phẩm mẫu và không còn bộ lọc thí nghiệm. [Nhật ký tích hợp](nhat-ky/npm-study.txt) |

Phân tích chính dùng 20 yêu cầu của `chain`, theo thứ tự lưu → đọc → xem trước → công bố → xuất trên một `searchId` cho mỗi ca. Dùng thêm bốn yêu cầu xuất trong `draft_fixture` để kiểm tra nhánh từ chối. Dữ liệu gốc được giữ nguyên như CLI xuất. [report.json](du-lieu-goc/run-s21uql/report.json) · [report.md do bộ chạy tạo](du-lieu-goc/run-s21uql/report.md)

## Kết quả và bằng chứng

### Ghi, đọc và công bố

| Thao tác | Vị trí / biến thể | Nguồn và ánh xạ `study_searches` | Ô hoặc vai trò | Mã bằng chứng |
| --- | --- | --- | --- | --- |
| Lưu | `SAVE_SEARCH/fixed` | ID từ URL → `id`. JSON → `category`, `sort_key`, `ceiling_dong`. | Ô 1 `id`, ô 2 `category`, ô 3 `sort`, ô 4 `ceiling`. | `RQ1-SAVE-ID`, `RQ1-SAVE-CATEGORY`, `RQ1-SAVE-SORT`, `RQ1-SAVE-CEILING` |
| Lưu | `SAVE_SEARCH/fixed` | Ứng dụng đặt cột `state` thành `draft`. | Hằng trong mẫu SQL. | `RQ1-SAVE-STATE` |
| Đọc trực tiếp, xem trước, xuất | `LOAD_SEARCH/fixed` | ID lấy từ URL của từng yêu cầu để tra theo `id`. | Ô 1 `id`. | `RQ1-LOAD-ID` |
| Đọc trực tiếp, xem trước, xuất | `LOAD_SEARCH/fixed` | `id` → `id`, `category` → `category`, `sort_key` → `sort`, `ceiling_dong` → `ceiling`, `state` → `state`. | Các cột kết quả trả về ứng dụng. | `RQ1-READ-ID`, `RQ1-READ-CATEGORY`, `RQ1-READ-SORT`, `RQ1-READ-CEILING`, `RQ1-READ-STATE` |
| Công bố | `PUBLISH_SEARCH/fixed` | ID từ URL yêu cầu công bố → điều kiện trên cột `id`. | Ô 1 `id`. | `RQ1-PUBLISH-ID` |
| Công bố | `PUBLISH_SEARCH/fixed` | Ứng dụng đặt cột `state` thành `published` khi hàng đang là `draft`. | Hằng gán và điều kiện trong mẫu SQL. | `RQ1-PUBLISH-STATE`, `RQ1-PUBLISH-DRAFT` |

Căn cứ từ mã là `readSearchInput`, `load`, `perform` và bộ phân tích URL trong trình xử lý. Các dòng ghi và công bố có `affectedRows=1` trong cả bốn ca chuỗi. Các lần tải có `rowCount=1`. Bước tải không đứng trước công bố vì `PUBLISH_SEARCH` tự kiểm tra `state='draft'` tại MySQL. ID đọc lại có mặt trong phản hồi `search`. ID dùng cho các truy vấn ghi, tải và công bố đều có nguồn `request`. [Trình xử lý HTTP](../../../../src/app.js) · [Mẫu SQL và phép chiếu](../../../../src/statements.js) · [Bảng bằng chứng theo yêu cầu](bang-chung.csv)

### Bản đồ tái sử dụng sau khi đọc

Mỗi mã bằng chứng trong bảng trỏ đến các dòng CSV mang `request_id`, `event_index` và tham chiếu mã. Với chuỗi chính, xem trước và xuất đều có `LOAD_SEARCH` tại `trace[0]`, quyết định nhánh tại `trace[1]`, rồi truy vấn danh mục tại `trace[2]`. Các ô được đánh số từ 1. [Nguồn nhánh trong `perform`](../../../../src/app.js) · [Nguồn ô trong `statements` và `execute`](../../../../src/statements.js)

| Trường và nguồn ban đầu | Cột MySQL | Ghi → đọc | Thao tác tái sử dụng | `site` | Vai trò | Điều kiện hoặc biến thể | Ô | Mã bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `category` từ JSON | `category` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xem trước | `PREVIEW_CATEGORY` | Giá trị ràng buộc | `name`, `price` | 1 | `RQ1-PREVIEW-CATEGORY-CATEGORY-1` |
| `category` từ JSON | `category` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xem trước | `PREVIEW_BUDGET` | Giá trị ràng buộc | `name`, `price` | 1 | `RQ1-PREVIEW-BUDGET-CATEGORY-1` |
| `category` từ JSON | `category` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xuất | `EXPORT_SEARCH` | Giá trị ràng buộc | `name`, `price` | 1 | `RQ1-EXPORT-CATEGORY-1` |
| `sort` từ JSON | `sort_key` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xem trước | `PREVIEW_CATEGORY` | Chọn biến thể | `name` theo tên, `price` theo giá | — | `RQ1-PREVIEW-CATEGORY-SORT` |
| `sort` từ JSON | `sort_key` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xem trước | `PREVIEW_BUDGET` | Chọn biến thể | `name` theo tên, `price` theo giá | — | `RQ1-PREVIEW-BUDGET-SORT` |
| `sort` từ JSON | `sort_key` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xuất | `EXPORT_SEARCH` | Chọn biến thể | `name` theo tên, `price` theo giá | — | `RQ1-EXPORT-SORT` |
| `ceiling` từ JSON tùy chọn | `ceiling_dong` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xem trước | `PREVIEW_CATEGORY` | Chọn vị trí | `null` | — | `RQ1-PREVIEW-CATEGORY-CEILING-SITE` |
| `ceiling` từ JSON tùy chọn | `ceiling_dong` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xem trước | `PREVIEW_BUDGET` | Chọn vị trí | Có trần giá | — | `RQ1-PREVIEW-BUDGET-CEILING-SITE` |
| `ceiling` từ JSON tùy chọn | `ceiling_dong` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xem trước | `PREVIEW_BUDGET` | Giá trị ràng buộc | So sánh `price_dong <= ?` | 2 | `RQ1-PREVIEW-BUDGET-CEILING-2` |
| `ceiling` từ JSON tùy chọn | `ceiling_dong` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xuất | `EXPORT_SEARCH` | Giá trị ràng buộc | Kiểm tra `? IS NULL`, kể cả khi giá trị là `null` | 2 | `RQ1-EXPORT-CEILING-2` |
| `ceiling` từ JSON tùy chọn | `ceiling_dong` | `SAVE_SEARCH` → `LOAD_SEARCH` | Xuất | `EXPORT_SEARCH` | Giá trị ràng buộc | So sánh `price_dong <= ?` trong cùng biểu thức giá, kể cả khi giá trị là `null` | 3 | `RQ1-EXPORT-CEILING-3` |
| `state` từ ứng dụng | `state` | `SAVE_SEARCH` tạo nháp, `PUBLISH_SEARCH` công bố → `LOAD_SEARCH` | Xuất | `EXPORT_SEARCH` | Điều kiện thực thi | `published` cho phép. `draft` trả 409. | — | `RQ1-EXPORT-PUBLISHED`, `RQ1-EXPORT-DRAFT` |

### Đối chiếu theo ca và trạng thái

Tất cả các lượt xem trước và xuất trong `chain` trả HTTP 200. Bảng ghi `itemIds` đúng thứ tự mà bộ chạy kiểm tra ở cả hai thao tác. Cùng một ca và nhóm có chung `searchId` cho năm yêu cầu, tra được qua mỗi `requestId`. [Dấu vết `runs[].requests[]`](du-lieu-goc/run-s21uql/report.json)

| Ca `chain` | Trần giá (đồng) | Xem trước / xuất | ID sản phẩm theo thứ tự | `requestId` xem trước / xuất |
| --- | ---: | --- | --- | --- |
| `name-unlimited` | `null` | `PREVIEW_CATEGORY/name` / `EXPORT_SEARCH/name` | 1, 2, 3 | `90cdce3d-9153-4ffb-8632-0fa86cf2d843`<br>`017be969-b0fc-439e-b933-bdbc8690dd30` |
| `price-unlimited` | `null` | `PREVIEW_CATEGORY/price` / `EXPORT_SEARCH/price` | 3, 2, 1 | `7457fd86-490e-4a78-ba5a-228c720007af`<br>`702ba212-ed32-4a53-8805-f89e7c445454` |
| `name-budget` | 250.000 | `PREVIEW_BUDGET/name` / `EXPORT_SEARCH/name` | 2, 3 | `3671ddfc-e50b-49b6-becd-3de7bd24c1b3`<br>`6c41ebf3-5fb9-4c30-8225-5bc44bb44d18` |
| `price-budget` | 250.000 | `PREVIEW_BUDGET/price` / `EXPORT_SEARCH/price` | 3, 2 | `6b4b7c06-924e-40a8-84eb-092c8c01bf0a`<br>`4af42a46-fe66-456a-a556-f86e968ae4f0` |

| Điều kiện khi gọi xuất | Số yêu cầu | Trình tự quan sát | HTTP | Bằng chứng |
| --- | ---: | --- | ---: | --- |
| `chain`, đã công bố | 4 | `LOAD_SEARCH` → `state=published, allowed=true` → `EXPORT_SEARCH` | 200 | `RQ1-EXPORT-PUBLISHED`, bốn ID xuất trong bảng trên |
| `draft_fixture`, bản ghi tồn tại ở trạng thái nháp | 4 | `LOAD_SEARCH` trả một hàng → `state=draft, allowed=false` và kết thúc yêu cầu | 409 | `RQ1-EXPORT-DRAFT`, ví dụ ca `name-unlimited` có `requestId=7fea5f9a-956e-4702-a26d-9f373c4909a6` |

## Kiểm chứng và sai lệch

Chạy lệnh sau từ thư mục hồ sơ để tính lại bảng bằng chứng và kiểm tra dữ liệu gốc. [Mã kiểm chứng](kiem-chung.mjs) · [Kết quả kiểm chứng](nhat-ky/kiem-chung.txt)

```powershell
node kiem-chung.mjs 'du-lieu-goc/run-s21uql' bang-chung.csv
```

Mã kiểm chứng lọc `runs[].suite = chain`, so khớp 4 ca × 5 thao tác theo thứ tự và kiểm tra `searchId` xuyên suốt từng ca. Từ `trace[]`, đếm riêng sự kiện SQL và quyết định, gộp độ bao phủ theo `site` và `(site, variant)`, đọc các ô theo `slot` và `source`. Đối chiếu trực tiếp thứ tự ô trong `rq1[].bindings`, các quy tắc trong `rq1[].selectors`, mẫu trong `rq1[].templates` và từng dòng danh mục RQ1 trong báo cáo Markdown của CLI. Đối chiếu mẫu số và tập biến thể với dòng `chain` trong phần độ bao phủ của cả hai báo cáo gốc. Tập quan sát có 28 sự kiện SQL, 8 quyết định, 8 lần gọi truy vấn tái sử dụng và 18 lượt ràng buộc ô có nguồn `stored`. `PREVIEW_CATEGORY` và `PREVIEW_BUDGET` chạy hai lần mỗi vị trí, một lần mỗi biến thể. `EXPORT_SEARCH` chạy bốn lần, hai lần mỗi biến thể. Kiểm tra nhánh nháp dùng `draft_fixture` với `operation=export`. Kết quả khớp dữ liệu gốc và tổng hợp của CLI. [report.json](du-lieu-goc/run-s21uql/report.json) · [report.md](du-lieu-goc/run-s21uql/report.md)

CSV gồm 82 dòng bằng chứng. `request_id` ánh xạ tới `requestId` trong JSON, `event_index` là chỉ số từ 0 và `source_ref` trỏ về tệp mã. Các dòng từ mã để trống `case`, `search_id`, `request_id` và `event_index`. `origin=request` chỉ nguồn từ yêu cầu hiện tại, `stored` chỉ dữ liệu đã đọc vào ứng dụng, `database` chỉ cột trả về hoặc điều kiện trực tiếp trong MySQL, và `application` chỉ hằng trạng thái do ứng dụng đặt. Ô `slot` trống với quyết định, cột kết quả và hằng SQL. Ở sự kiện quyết định, `site` chỉ vị trí được chọn hoặc được kiểm soát, còn `variant` trống vì sự kiện đó chỉ ghi quyết định. Riêng mã `RQ1-EXPORT-DRAFT` chỉ quyết định chặn truy vấn xuất. [Bảng bằng chứng](bang-chung.csv)

Node ghi thông báo thiếu tệp `.env` ở bước khởi tạo và tích hợp. Hai lệnh đều thoát mã 0 vì cấu hình đã được cung cấp qua biến môi trường. Máy chủ tạm dừng bình thường sau lượt chạy. [Nhật ký phiên chạy](nhat-ky/phien-chay.txt)

## Diễn giải và giới hạn

`perform` kiểm tra `search.ceiling !== null` trước khi chọn truy vấn xem trước. Khi có trần giá, `PREVIEW_BUDGET` còn truyền chính giá trị ấy vào ô 2. Cặp ca cùng kiểu sắp xếp ở hai mức trần giá cho thấy truy vấn xuất giữ cặp `(site, variant)` và cả hai ô giá, trong khi kết quả lọc thay đổi. So sánh hai kiểu sắp xếp tại cùng mức trần giá cho thấy `sort` chọn mẫu đã khai báo với cột `name` hoặc `price_dong`, đều dùng `item_id` làm khóa phụ. Trình thực thi chọn mẫu rồi gọi `connection.execute(template, params)`. [Trình xử lý và truy vấn](../../../../src/app.js) · [Danh mục và hàm thực thi](../../../../src/statements.js) · [MySQL PREPARE](https://dev.mysql.com/doc/refman/8.0/en/prepare.html) · [mysql2 Prepared Statements](https://sidorares.github.io/node-mysql2/docs/documentation/prepared-statements)

Các phép đo áp dụng cho ứng dụng, bốn ca và hai trạng thái đã khảo sát. Sự kiện SQL phát sau khi driver trả kết quả và lưu siêu dữ liệu ô tham số. Đối chiếu nội dung bản ghi đọc lại dựa trên khẳng định về phản hồi mà bộ chạy thực hiện trước khi ghi báo cáo. Báo cáo gốc giữ ID sản phẩm và số dòng thay cho toàn bộ nội dung phản hồi và giá trị trên từng ô. Kết luận về cách chuyển giá trị giới hạn ở ranh giới gọi driver. [Kiểm tra phản hồi trong `verify`](../../../../src/study.js) · [Điểm quan sát trong `execute`](../../../../src/statements.js)

## Hình và đoạn trích cho tiểu luận

**Hình 1. Luồng tái sử dụng dữ liệu bộ lọc trong ứng dụng MySQL.** Bộ lọc được ghi bằng `SAVE_SEARCH` và đọc lại bằng `LOAD_SEARCH`. Khi xem trước, `ceiling` chọn vị trí SQL và bổ sung điều kiện giá ở nhánh có trần giá. Khi xuất, `state` quyết định truy vấn có chạy và `ceiling` được truyền vào hai ô tham số. Cả hai thao tác chọn mẫu sắp xếp cố định theo `sort`. Hình minh họa thiết kế từ mã nguồn. [SVG](hinh/luong-du-lieu.svg) · [PNG 2880 × 1620](hinh/luong-du-lieu.png) · [Sơ đồ thiết kế gốc](../../../hinh/luong-du-lieu.svg)

> Trong bốn ca thực nghiệm trên ứng dụng cục bộ dùng MySQL 8.0.46, chuỗi lưu, đọc, xem trước, công bố và xuất bao phủ cả ba vị trí SQL tái sử dụng và sáu biến thể theo danh mục mã. Trường `category` đọc lại được ràng buộc làm giá trị lọc, còn `sort` chọn mẫu sắp xếp cố định. `ceiling` có hai vai trò ở thao tác xem trước vì nó vừa chọn nhánh vừa cung cấp giá trị lọc khi có trần giá. Tại bước xuất, mỗi biến thể giữ hai ô giá, kể cả khi trần giá là `null`. Truy vấn xuất được thực thi sau khi bản ghi đạt trạng thái `published` do ứng dụng quản lý. Kết quả mô tả các nhánh và dữ liệu mẫu đã khảo sát tại ranh giới gọi driver.

## Kiểm tra trước khi bàn giao

- [x] Trả lời đủ vị trí tái sử dụng, loại vai trò và trường quản lý trạng thái, có mã bằng chứng cho từng dòng.
- [x] Tính lại số yêu cầu, sự kiện, vị trí, biến thể và ô theo dữ liệu gốc.
- [x] Hồ sơ có dữ liệu gốc, cách tái lập phép kiểm chứng, điều kiện môi trường và phạm vi kết luận.
- [x] Kiểm tra nội dung sơ đồ thiết kế và khả năng đọc ở khung hình 16:9.
