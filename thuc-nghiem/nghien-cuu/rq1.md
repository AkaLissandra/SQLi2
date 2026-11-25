# RQ1 · Cơ chế tái sử dụng dữ liệu đã lưu

> Trong ứng dụng dùng MySQL được khảo sát, dữ liệu do người dùng cung cấp sau khi được ghi và đọc lại đi đến những vị trí tạo SQL nào, và được sử dụng ở đó dưới dạng giá trị tham số hay đầu vào để chọn cấu trúc truy vấn?

Trả lời bằng một bản đồ trường dữ liệu → nơi ghi → nơi đọc → vị trí SQL → vai trò. Dùng [quy trình chung](README.md) và [mẫu báo cáo](mau-bao-cao.md).

## Phương pháp

1. Đối chiếu hợp đồng API với `readSearchInput`, `load` và `perform` trong [app.js](../src/app.js), bảng `study_searches` trong [database.js](../src/database.js) và danh mục trong [statements.js](../src/statements.js). Ghi ID vị trí và tệp hoặc hàm làm căn cứ.
2. Đi từ `PUT` qua `SAVE_SEARCH` đến các cột lưu trữ và ánh xạ ngược của `LOAD_SEARCH`. Phân biệt nguồn ban đầu với nguồn ở thời điểm gọi SQL. Ví dụ, ID có thể xuất hiện trong bản ghi, nhưng `LOAD_SEARCH` và `PUBLISH_SEARCH` dùng ID lấy từ URL của yêu cầu hiện tại. `state` được lưu trong bảng và do ứng dụng thiết lập.
3. Lập danh sách mọi vị trí có ô tham số hoặc quyết định phụ thuộc dữ liệu đã đọc. Tại mỗi vị trí, ghi rõ vai trò `giá trị ràng buộc`, `chọn vị trí`, `chọn biến thể` hoặc `điều kiện thực thi`. Một trường có thể có nhiều vai trò. Giữ số thứ tự từng ô nếu một trường được truyền nhiều lần.
4. Trong `report.json`, lấy danh mục `rq1` làm điểm bắt đầu. Dùng `runs[]` với `suite = chain` để xác nhận trình tự ghi, đọc và tái sử dụng trên cùng `searchId`. Trong từng yêu cầu xem trước hoặc xuất, đối chiếu `LOAD_SEARCH`, quyết định nhánh, `site`, `variant`, `bindings` và phản hồi. Dùng cả bốn ca trong [study.js](../src/study.js) để đối chiếu hai giá trị `sort` và hai nhánh trần giá.
5. Với mỗi dòng trong bản đồ, ghi căn cứ từ mã và `requestId` làm bằng chứng thực thi nếu quan sát được. Đánh dấu vị trí hoặc biến thể chỉ có bằng chứng từ mã. Đối chiếu dữ liệu đọc lại qua các khẳng định của bộ chạy vì siêu dữ liệu theo ô trong dấu vết ghi nguồn và cách xử lý.

## Điểm cần đối chiếu với mã và dấu vết

| Trường | Dấu hiệu để kiểm tra |
| --- | --- |
| `category` | Cột `category`, điều kiện lọc tại các vị trí xem trước và xuất |
| `sort` | Cột `sort_key`, chọn mẫu sắp xếp cố định `name` hoặc `price` |
| `ceiling` | Cột `ceiling_dong`, quyết định nhánh xem trước. Khi có trần giá, nhánh xem trước tương ứng dùng một ô giá. Truy vấn xuất dùng hai ô, kể cả khi giá trị là `null` |
| `state` | Trạng thái do ứng dụng quản lý, dùng làm điều kiện thực thi truy vấn xuất |
| `id` | Truyền từ yêu cầu hiện tại khi lưu, tải hoặc công bố. Ghép chuỗi qua giá trị ID của bộ lọc |

Kiểm tra riêng `PREVIEW_CATEGORY`, `PREVIEW_BUDGET` và `EXPORT_SEARCH`. Giải thích vì sao cùng trường `ceiling` vừa có thể quyết định nhánh vừa có thể là giá trị. Chỉ ra khi nào sự thay đổi `sort` làm đổi mẫu và khi nào sự thay đổi `ceiling` chỉ đổi giá trị của các ô trong cùng biến thể xuất.

## Đầu ra

- Bảng bản đồ trường với cột nguồn ban đầu, cột MySQL, vị trí ghi và đọc, thao tác tái sử dụng, `site`, vai trò, điều kiện hoặc biến thể, ô tham số và mã bằng chứng. Liệt kê riêng các vị trí ghi, tải, công bố để định vị đường đi của dữ liệu.
- `bang-chung.csv` có các cột `evidence_id,case,search_id,request_id,operation,event_index,site,variant,field,origin,role,slot,source_ref`. Dùng chỉ số sự kiện từ 0 trong `trace[]`. Với dòng từ mã, ghi `source_ref` đến tệp và hàm hoặc dòng.
- Một đoạn trả lời trực tiếp nêu vị trí tái sử dụng, trường có nhiều vai trò và trạng thái do ứng dụng quản lý. Dùng [sơ đồ thiết kế](hinh/luong-du-lieu.svg) hoặc lưu bản cập nhật trong hồ sơ nếu mã đã đổi.
