# RQ2 · Kiểm soát phòng thủ

> Khi giữ nguyên luồng nghiệp vụ và quy tắc chọn cấu trúc SQL, việc mở rộng ràng buộc tham số từ bước ghi sang các bước tái sử dụng làm thay đổi số lượng và danh sách vị trí vi phạm tiêu chí tách dữ liệu khỏi cấu trúc SQL như thế nào?

Đo chênh lệch theo tiêu chí phòng thủ. Dùng [quy trình chung](README.md) và [mẫu báo cáo](mau-bao-cao.md).

## Thiết kế đối chiếu

| Chính sách | Nguồn bằng chứng | Tiêu chí ở bước tái sử dụng |
| --- | --- | --- |
| A · Chỉ ràng buộc khi ghi | Mô hình trên dấu vết (`metadata_counterfactual`) | Đánh dấu mỗi ô giá trị có `source = stored` là bỏ ràng buộc theo mô hình |
| B · Ràng buộc khi ghi và tái sử dụng | Dấu vết MySQL của ứng dụng thực thi | Đọc `source` và `treatment` của từng ô trong sự kiện SQL |

Hai chính sách dùng cùng chuỗi nghiệp vụ, bản ghi, mẫu SQL, quy tắc chọn vị trí và biến thể, điều kiện cho phép xuất và ràng buộc cho ID của yêu cầu hiện tại. MySQL thực thi chính sách B. Chính sách A là phép gán lại nhãn trên chính dấu vết đó. Mức chênh lệch biểu thị hệ quả của quy tắc phân loại trên các vị trí quan sát được. Độ tin cậy của phép đo dựa trên tính đúng của việc xác định ô giá trị đã lưu và đơn vị đếm.

Đơn vị đếm là `site`. Vị trí vi phạm nếu có ít nhất một ô giá trị đã đọc lại được xử lý ngoài ràng buộc theo chính sách tương ứng. Đếm mỗi vị trí một lần qua tất cả lần gọi và biến thể. Với hai ô cùng một trường, ghi đủ hai ô trong bảng chẩn đoán. Trường dùng để chọn một mẫu cố định hoặc để điều khiển việc thực thi thuộc phần kiểm tra quy tắc chọn cấu trúc.

## Thực hiện và kiểm chứng

1. Dùng nhóm `chain` trong `report.json`. Đối chiếu `rq2.method`, `rq2.observedSites`, `rq2.sites` và các sự kiện `type = sql` trong `runs[]`. Kiểm tra các vị trí tái sử dụng trong danh mục đều có dấu vết. Ghi riêng mọi trường hợp thiếu quan sát.
2. Đối chiếu mẫu, vị trí gọi driver, `bindings` và `selectors` với [statements.js](../src/statements.js) và [app.js](../src/app.js). Xác nhận nguồn `stored`, `treatment`, thứ tự ô và mẫu được chọn. Kiểm tra `category` và `ceiling` theo vai trò giá trị, `sort` theo mẫu đã đăng ký và `state` theo điều kiện nghiệp vụ.
3. Duyệt đủ sự kiện thực thi của từng vị trí, qua cả hai biến thể nếu có. [Mã tổng hợp hiện tại](../src/report.js) dùng sự kiện đầu tiên cho mỗi `site`. Xác nhận đại diện đó khớp với các lần còn lại về danh sách ô và nhãn cần đo. Nếu có khác biệt, lưu trường hợp lệch và tính chỉ số chính từ hợp ô vi phạm theo toàn bộ sự kiện. Giải thích chênh lệch với bản tổng hợp tự động.
4. Tính tập vị trí vi phạm A và B, hiệu hai chiều `A \ B` và `B \ A`, cùng mức giảm `|A| − |B|`. Với mọi vị trí thay đổi, nêu trường và ô tương ứng. Ghi rõ bộ vị trí quan sát và các trường hợp chỉ suy ra từ danh mục.

## Đầu ra

- Bảng hai chính sách gồm nguồn bằng chứng, số vị trí vi phạm, tập ID vị trí và mức giảm. Kèm bảng theo vị trí và ô, với nhãn mô hình A và nhãn quan sát B.
- `bang-chung.csv` có các cột `evidence_id,case,request_id,event_index,site,variant,slot,field,source,model_treatment,observed_treatment,source_ref`. Dùng chỉ số sự kiện từ 0 trong `trace[]`. Giải thích cách chọn dòng đại diện và kiểm tra tính nhất quán của các lần gọi.
- Đoạn kết luận giới hạn ở tiêu chí tách dữ liệu và cấu trúc tại các vị trí quan sát được. Bảng hoặc hình dùng từ `mô hình` cho A và `thực thi` cho B. Nêu giả định của A khi diễn giải độ lớn chênh lệch.
