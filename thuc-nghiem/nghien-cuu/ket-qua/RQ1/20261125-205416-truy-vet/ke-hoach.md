# Kế hoạch RQ1 · Cơ chế tái sử dụng dữ liệu đã lưu

Lập ngày 25/11/2026 (UTC+07:00), trước khi chạy kiểm thử và lượt tích hợp. Mã đợt `20261125-205416-truy-vet`. SHA lúc bắt đầu `326acdd58022585971889f55ff50e7bb47b5064c`. `git status --short` lúc bắt đầu không có đầu ra, vì vậy hồ sơ phân tích dùng mã đã commit. Có một lượt chạy cũ dưới thư mục bị Git bỏ qua `results/`. Kế hoạch dùng một lượt mới làm bằng chứng chính.

## Phạm vi và thiết kế

Ứng dụng HTTP lắng nghe trên loopback. MySQL 8.0.46 chạy ở một phiên riêng trên loopback, dùng schema nghiên cứu mới và dữ liệu tổng hợp trong [database.js](../../../../src/database.js). Chạy bộ kiểm thử rồi dùng bộ chạy tích hợp sẵn có. Đọc sâu nhóm `chain` và dùng yêu cầu xuất từ `draft_fixture` để quan sát nhánh từ chối. Đơn vị truy vết là trường tại một ô tham số hoặc một quyết định của vị trí SQL, trên một yêu cầu cụ thể. Khóa bằng chứng là `requestId` và chỉ số sự kiện từ 0 trong `trace[]`, bổ sung `slot` cho tham số. Khóa đếm bao phủ là `site` hoặc cặp `(site, variant)`.

Mỗi ca chạy tuần tự lưu, đọc, xem trước, công bố và xuất trên một `searchId`. Bốn ca theo [study.js](../../../../src/study.js) kết hợp `sort=name|price` với `ceiling=null|250000`, dùng cùng danh mục mẫu. Dự kiến 20 yêu cầu chuỗi và 60 yêu cầu trong toàn bộ lượt tích hợp. Kết quả chuẩn của bốn ca theo thứ tự `name-unlimited`, `price-unlimited`, `name-budget`, `price-budget` lần lượt là ID sản phẩm `[1,2,3]`, `[3,2,1]`, `[2,3]`, `[3,2]` cho xem trước và xuất thành công.

## Giả thuyết và tiêu chí quan sát

- `SAVE_SEARCH` ghi `id`, `category`, `sort`, `ceiling` từ yêu cầu vào các ô 1–4 và tạo `draft`. `LOAD_SEARCH` dùng ID của URL hiện tại ở ô 1 và đọc các trường đã lưu. `PUBLISH_SEARCH` dùng ID của URL hiện tại ở ô 1 và chuyển từ `draft` sang `published`.
- Xem trước với `ceiling=null` chọn `PREVIEW_CATEGORY`, với trần giá 250.000 đồng chọn `PREVIEW_BUDGET`. Cả hai ràng buộc `category` ở ô 1. Nhánh có trần giá thêm `ceiling` ở ô 2. Mỗi truy vấn xuất thành công chạy `EXPORT_SEARCH` với `category` ở ô 1 và `ceiling` ở ô 2 và 3, kể cả khi trần giá là `null`.
- `sort` đọc lại chọn biến thể `name` hoặc `price` trong cả ba vị trí tái sử dụng. Đổi riêng trần giá giữ nguyên biến thể xuất với từng `sort`. Dự kiến quan sát đủ 3 vị trí và 6 cặp vị trí–biến thể tái sử dụng có trong [statements.js](../../../../src/statements.js).
- `state` do ứng dụng quản lý. Mỗi yêu cầu xuất thành công có `LOAD_SEARCH`, quyết định cho phép với `published`, rồi `EXPORT_SEARCH`. Yêu cầu xuất từ fixture nháp có `LOAD_SEARCH`, quyết định từ chối với `draft` và HTTP 409.
- Đối chiếu trình tự trong từng yêu cầu, `protocol`, nguồn `request` hoặc `stored`, vai trò và thứ tự ô với danh mục SQL và nhánh trong [app.js](../../../../src/app.js). Dùng trạng thái HTTP, ID sản phẩm, và các khẳng định của bộ chạy về nội dung phản hồi để kiểm tra dữ liệu đọc lại.

## Giới hạn dự kiến

Bốn ca cố định dùng danh mục và sản phẩm mẫu, tập trung vào luồng nghiệp vụ đã chọn. Sự kiện SQL ghi sau khi driver báo kết quả và chứa siêu dữ liệu ràng buộc. Giá trị thực và nội dung phản hồi đầy đủ được bộ chạy kiểm tra nhưng không lưu trong từng sự kiện SQL. Kết luận giới hạn ở ranh giới gọi driver và các trường hợp đã khảo sát.
