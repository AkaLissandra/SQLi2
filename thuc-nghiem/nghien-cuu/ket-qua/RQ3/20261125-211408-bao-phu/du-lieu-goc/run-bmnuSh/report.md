# Kết quả thí nghiệm tái sử dụng dữ liệu lưu trong MySQL

MySQL 8.0.46, Node.js v24.21.0, mysql2 3.24.6. Thời điểm chạy (UTC) 2026-11-25T14:17:25.642Z.

## RQ1 · Đường đi của dữ liệu

`SAVE_SEARCH` ghi `category`, `sort` và `ceiling` qua tham số. Hai thao tác xem trước và xuất danh mục đọc lại bản ghi bằng `LOAD_SEARCH` rồi dùng chính bản ghi đó. `request` là dữ liệu của yêu cầu hiện tại. `stored` là dữ liệu do MySQL trả về.

| Vị trí | Các tham số theo thứ tự | Quyết định dựa trên bản ghi |
| --- | --- | --- |
| `SAVE_SEARCH` | `request.id`, `request.category`, `request.sort`, `request.ceiling` | — |
| `LOAD_SEARCH` | `request.id` | — |
| `PUBLISH_SEARCH` | `request.id` | — |
| `PREVIEW_CATEGORY` | `stored.category` | `ceiling` (chọn vị trí), `sort` (chọn mẫu) |
| `PREVIEW_BUDGET` | `stored.category`, `stored.ceiling` | `ceiling` (chọn vị trí), `sort` (chọn mẫu) |
| `EXPORT_SEARCH` | `stored.category`, `stored.ceiling`, `stored.ceiling` | `state` (điều kiện thực thi), `sort` (chọn mẫu) |

`state` do ứng dụng quản lý. `sort` chọn một trong hai mệnh đề sắp xếp cố định. Kiểm tra `ceiling` có giá trị hay không quyết định vị trí truy vấn xem trước. Truy vấn xuất luôn dùng cùng điều kiện giá cho mỗi thứ tự sắp xếp, với `ceiling` ràng buộc ở hai vị trí.

## RQ2 · Mở rộng ràng buộc tham số

| Chính sách | Số vị trí vi phạm | Vị trí |
| --- | ---: | --- |
| Chỉ ràng buộc khi ghi (mô hình) | 3 | `PREVIEW_CATEGORY`, `EXPORT_SEARCH`, `PREVIEW_BUDGET` |
| Ràng buộc cả khi ghi và khi tái sử dụng (thực thi) | 0 | — |

Chênh lệch là **3 vị trí**. Tiêu chí đếm một vị trí nếu nó có ít nhất một ô giá trị từ bản ghi mà chính sách bỏ ràng buộc. Mô hình áp tiêu chí này trên dấu vết của cùng luồng nghiệp vụ. Ràng buộc cho ID của yêu cầu hiện tại và quy tắc chọn mẫu giống nhau ở cả hai chính sách. Mọi câu SQL nghiệp vụ gửi đến MySQL đều sử dụng prepared statement.

- `PREVIEW_CATEGORY` có các vị trí giá trị sau trong mô hình chỉ ràng buộc khi ghi: `category [1]`.
- `EXPORT_SEARCH` có các vị trí giá trị sau trong mô hình chỉ ràng buộc khi ghi: `category [1]`, `ceiling [2]`, `ceiling [3]`.
- `PREVIEW_BUDGET` có các vị trí giá trị sau trong mô hình chỉ ràng buộc khi ghi: `category [1]`, `ceiling [2]`.

## RQ3 · Độ bao phủ

Mỗi nhóm chạy cùng 5 thao tác HTTP trên 4 ca đầu vào. Hai giá trị `sort` kết hợp với hai giá trị của `ceiling` (`null` và 250.000 đồng). Mẫu số lấy từ danh mục các vị trí và biến thể tái sử dụng. Một lần gọi được quan sát khi MySQL trả kết quả thành công cho câu lệnh, kể cả khi trả về 0 dòng.

| Nhóm | Yêu cầu | Vị trí | Biến thể | Vị trí chưa quan sát |
| --- | ---: | ---: | ---: | --- |
| `draft_fixture` | 20 | 2/3 (66.7%) | 4/6 (66.7%) | `EXPORT_SEARCH` |
| `chain` | 20 | 3/3 (100.0%) | 6/6 (100.0%) | — |
| `state_matched_fixture` | 20 | 3/3 (100.0%) | 6/6 (100.0%) | — |

- `EXPORT_SEARCH` thiếu ở nhóm fixture nháp. 4 yêu cầu xuất gặp trạng thái `draft` và nhận HTTP 409. Chênh lệch giữa fixture nháp và chuỗi nằm ở `EXPORT_SEARCH/name`, `EXPORT_SEARCH/price`.
- Bản ghi có và không có trần giá xuất hiện trong cả ba nhóm. Vì vậy cả hai vị trí xem trước đều được quan sát.
- Fixture thỏa tiền điều kiện nghiệp vụ cho từng yêu cầu đạt cùng độ bao phủ với chuỗi. Riêng thao tác xuất cần fixture đã công bố, tương ứng với trạng thái mà chuỗi đạt được sau thao tác công bố.

Số liệu mô tả các ca và trạng thái đã chọn trong ứng dụng này. Xem `report.json` để đối chiếu từng yêu cầu, thứ tự vị trí SQL, ô tham số, mẫu và quyết định nhánh.
