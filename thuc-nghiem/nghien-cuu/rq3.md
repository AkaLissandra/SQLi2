# RQ3 · So sánh độ bao phủ

> Trên cùng tập chức năng, với dữ liệu hợp lệ và cùng tiêu chí quan sát truy vấn, độ bao phủ các vị trí tạo SQL sử dụng dữ liệu đã lưu khác nhau thế nào giữa kiểm thử từng yêu cầu có fixture hợp lệ và kiểm thử theo chuỗi ghi–đọc lại–tái sử dụng? Điều kiện trạng thái hoặc nhánh nghiệp vụ nào giải thích từng chênh lệch?

Dùng [quy trình chung](README.md) và [mẫu báo cáo](mau-bao-cao.md). Kết quả chính là bảng độ bao phủ cho từng nhóm và giải thích từng khác biệt bằng dấu vết.

## Nhóm và biến kiểm soát

| Nhóm | Cách chuẩn bị | Vai trò |
| --- | --- | --- |
| `chain` | Lưu, đọc lại, xem trước, công bố và xuất trên cùng `searchId` cho từng ca | Chuỗi nghiệp vụ |
| `state_matched_fixture` | Mỗi yêu cầu có ID riêng. Ca lưu dùng ID mới. Ca đọc, xem trước và công bố có bản ghi nháp. Ca xuất có bản ghi đã công bố | Đối chiếu chính với chuỗi |
| `draft_fixture` | Chuẩn bị như nhóm fixture khớp trạng thái, dùng bản ghi nháp cho yêu cầu xuất | Đối chiếu bổ sung để cô lập vai trò trạng thái của yêu cầu xuất |

Bản ghi `draft` hợp lệ theo schema. Để thỏa tiền điều kiện cho thao tác xuất, bản ghi phải ở trạng thái `published`. Dùng cùng năm thao tác HTTP, cùng bộ trình xử lý, dữ liệu danh mục, giá trị bộ lọc, quy tắc SQL và tiêu chí quan sát. [Bộ chạy hiện tại](../src/study.js) có bốn ca giao giữa `sort ∈ {name, price}` và `ceiling ∈ {null, 250000}`, tương ứng 20 yêu cầu mỗi nhóm. Kiểm tra số thực tế trong báo cáo.

## Đo và đối chiếu

1. Chốt mẫu số từ danh mục `statements` và `reuseSites` trước khi đọc kết quả. Tập vị trí gồm các `site` có ô giá trị hoặc bộ chọn dùng dữ liệu đã đọc từ bản ghi. Tập biến thể là mọi cặp `(site, variant)` của các vị trí đó. Đối chiếu với `rq3.denominator`. SQL chuẩn bị fixture, thiết lập kết nối, khởi tạo và dọn dữ liệu nằm ngoài phép đo.
2. Tính cho mỗi nhóm bằng cách lọc `type = sql` trong từng `trace[]`, giữ các vị trí thuộc mẫu số, rồi gộp theo `site` và theo `(site, variant)`. Một vị trí hoặc biến thể được bao phủ nếu có ít nhất một lần thực thi thành công qua driver. Tính `số quan sát được / tổng trong danh mục`, ghi cả phân số và phần trăm. Liệt kê các tập đã và chưa quan sát. Kiểm tra mã HTTP, số yêu cầu và tổ hợp ca ở mọi nhóm.
3. So sánh `chain` với `state_matched_fixture` trước. Báo chênh lệch theo số vị trí, số biến thể và điểm phần trăm. Tính hiệu tập hợp theo cả hai chiều cho vị trí và biến thể. Nếu hai nhóm bằng nhau, ghi hai hiệu tập hợp rỗng và minh họa cách cả hai đạt từng nhánh. So sánh `state_matched_fixture` với `draft_fixture` để xét tác động của trạng thái. Dùng thêm `chain` và `draft_fixture` để minh họa đường đi qua thao tác công bố. Tự tính các cặp so sánh này từ dấu vết vì `rq3.differences` hiện tóm tắt chuỗi so với fixture nháp.
4. Với mỗi khác biệt, ghép ca theo `case` và `operation`. Dẫn `requestId`, mã HTTP, thứ tự sự kiện SQL, trạng thái hoặc điều kiện nhánh và vị trí đích. Dùng sự kiện `export_requires_published` để xác nhận trạng thái trình xử lý đọc, và dùng `startingState` để đối chiếu với trạng thái dự kiến của kịch bản. Với xem trước, đối chiếu `preview_ceiling` và vị trí được chọn. Phân biệt chênh lệch quan sát được với khác biệt dự đoán nếu bổ sung ca mới.

Đây là phép đo độ bao phủ mô tả trên bộ ca đã thiết kế. Số yêu cầu cho biết khối lượng kiểm thử. Độ bao phủ được tính từ tập vị trí hoặc biến thể phân biệt, với mẫu số lấy từ danh mục mã.

## Đầu ra

- Bảng độ bao phủ theo nhóm với số yêu cầu, phân số, phần trăm, danh sách vị trí và biến thể đã hoặc chưa quan sát. Kèm bảng chênh lệch có chiều so sánh, hiệu tập hợp và điều kiện giải thích.
- `bang-chung.csv` có các cột `evidence_id,suite,case,operation,search_id,request_id,status,starting_state,decision_rule,decision_value,event_index,site,variant,source_ref`. Dùng chỉ số sự kiện từ 0 trong `trace[]`. Với bằng chứng cho vị trí không xuất hiện, ghi quyết định nhánh cùng sự kiện SQL cuối của yêu cầu và giải thích hai dòng trong báo cáo.
- Nếu làm hình, ưu tiên ma trận nhóm × vị trí hoặc biến thể. Chú thích mẫu số và làm rõ nhóm fixture nháp dùng để kiểm tra tiền điều kiện xuất. Phân biệt kết quả trên tập ca đã chọn với khả năng bao phủ của các tập fixture khác.
