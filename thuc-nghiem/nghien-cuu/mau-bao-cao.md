# Mẫu hồ sơ thực nghiệm cho một RQ

Tạo hồ sơ theo [quy trình chung](README.md). Dùng tiêu đề bên dưới cho `bao-cao.md` và điền nội dung của RQ được giao. Ghi giả thuyết và tiêu chí vào `ke-hoach.md` trước lượt chạy. Báo cáo dẫn lại kế hoạch và giải thích các thay đổi đã xảy ra.

## Câu hỏi và câu trả lời

Chép nguyên văn câu hỏi. Tóm tắt câu trả lời bằng kết quả chính, điều kiện của phép đo và một liên kết đến bảng bằng chứng. Ghi trạng thái `Hoàn tất` hoặc `Hoàn tất một phần` theo mức bằng chứng.

## Thiết kế và môi trường

Nêu đơn vị phân tích, phạm vi, thiết kế so sánh hoặc truy vết, bộ ca, nguồn bằng chứng, tiêu chí và mẫu số tương ứng. Ghi mã đợt, SHA, tệp local ảnh hưởng đến phép đo, phiên bản thực tế, thời điểm kèm múi giờ, lệnh, mã thoát và kết quả kiểm thử. Liên kết `ke-hoach.md` và các tệp gốc. Nếu có nhiều lượt, mô tả vai trò của từng lượt và tiêu chí chọn lượt chính.

## Kết quả và bằng chứng

Đưa bảng chính và bảng chẩn đoán theo hướng dẫn của RQ. Ghi đơn vị và điều kiện ở từng hàng khi cần. Dẫn mã bằng chứng trong `bang-chung.csv`, trường trong `report.json` và phần mã liên quan. Mỗi luận điểm về thực thi cần truy được đến yêu cầu hoặc điều kiện lọc và tập sự kiện cụ thể. Dùng `requestId` cùng bộ ca, nhóm và thao tác để tái tra bằng chứng.

## Kiểm chứng và sai lệch

Ghi cách tự tính lại bảng, khóa gộp, bộ lọc, kết quả đối chiếu và lời giải cho mọi sai lệch. Ghi rõ dữ liệu chạy mới, dữ liệu từ lượt cũ, kết quả đọc mã và kết quả mô hình ở các nơi sử dụng. Nếu một bước thất bại, ghi thông báo đã lược thông tin nhạy cảm, cách xử lý và phần kết luận còn thiếu căn cứ.

## Diễn giải và giới hạn

Giải thích nguyên nhân dựa trên mã và sự kiện. Nêu các yếu tố ảnh hưởng trực tiếp như dữ liệu mẫu, bộ ca, điều kiện trạng thái, điểm quan sát tại driver hoặc giả định mô hình nếu liên quan. Ghi phạm vi mà kết luận hỗ trợ để người viết tiểu luận có thể dùng đúng mức bằng chứng.

## Hình và đoạn trích cho tiểu luận

Với mỗi hình sử dụng, ghi đường dẫn, chú thích hoàn chỉnh, nguồn và đơn vị nếu là hình định lượng. Viết một đoạn văn ngắn có thể đưa vào phần kết quả hoặc thảo luận, gồm phát hiện, điều kiện thực nghiệm và giới hạn có ảnh hưởng đến kết luận.

## Kiểm tra trước khi bàn giao

- [ ] Câu trả lời bao quát từng vế của RQ và có liên kết đến bằng chứng tương ứng.
- [ ] Bảng chính đã được tính lại và kiểm tra với dữ liệu gốc. Các số, tập ID và mẫu số nhất quán giữa văn bản, bảng và hình.
- [ ] Hồ sơ có đường dẫn tương đối hợp lệ, thông tin tái lập và mức độ hoàn thành rõ ràng.
- [ ] Chữ và chú giải trong hình đọc được khi chèn vào tài liệu hoặc slide.
