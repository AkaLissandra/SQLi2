# Kế hoạch RQ3 · So sánh độ bao phủ

## Phạm vi và phiên bản

- Mã đợt `20261125-211408-bao-phu`. Bắt đầu chuẩn bị lúc 21:14:08 ngày 25/11/2026 (UTC+07:00).
- `git rev-parse HEAD` trả về `608361d0708a2bdf2ec1a0f7c170bf97ded69a3b`. `git status --short` rỗng khi bắt đầu. Dùng nguyên mã ứng dụng và bộ chạy.
- Phạm vi là ứng dụng HTTP trên loopback, một schema MySQL riêng và dữ liệu danh mục tổng hợp. Bộ chạy tích hợp thu thập dấu vết cho cả ba RQ. Phân tích tập trung vào độ bao phủ của RQ3. [Thiết kế RQ3](../../../rq3.md) · [Bộ chạy](../../../../src/study.js)

## Nhóm và bộ ca

Mỗi nhóm có năm thao tác theo thứ tự khai báo `save` → `load` → `preview` → `publish` → `export` trên bốn ca `name-unlimited`, `price-unlimited`, `name-budget` và `price-budget`. Đầu vào dùng cùng danh mục mẫu, thứ tự `name` hoặc `price` và trần giá `null` hoặc 250.000 đồng. Dự kiến 20 yêu cầu mỗi nhóm.

| Nhóm | ID và trạng thái |
| --- | --- |
| `chain` | Từng ca dùng cùng ID, bản ghi từ `draft` chuyển sang `published` khi công bố trước khi xuất. |
| `state_matched_fixture` | Mỗi yêu cầu dùng ID riêng. Lưu dùng ID mới, đọc/xem trước/công bố có bản ghi `draft`, xuất có bản ghi `published`. |
| `draft_fixture` | Cùng cách chuẩn bị với nhóm fixture khớp trạng thái, thao tác xuất dùng bản ghi `draft`. |

## Tiêu chí và giả thuyết

- Mẫu số chốt từ `statements` và `reuseSites` là ba vị trí `PREVIEW_CATEGORY`, `PREVIEW_BUDGET`, `EXPORT_SEARCH`. Mỗi vị trí có hai biến thể `name` và `price`, tổng cộng sáu cặp `(site, variant)`. [Danh mục SQL](../../../../src/statements.js)
- Lọc sự kiện `sql` trong từng `trace[]` theo mẫu số. Sự kiện được ghi khi driver đã trả kết quả thành công, kể cả 0 dòng. Gộp riêng theo `site` và theo cặp `(site, variant)`. SQL chuẩn bị fixture, khởi tạo, thiết lập kết nối và dọn dữ liệu nằm ngoài phép đo.
- Giả thuyết chính là `chain` và `state_matched_fixture` cùng đạt 3/3 vị trí và 6/6 biến thể, cả hai chiều hiệu tập hợp đều rỗng. Giả thuyết bổ sung là `draft_fixture` thiếu một vị trí xuất và hai biến thể của vị trí đó do tiền điều kiện `published`.
- Ghép theo `case` và `operation`. Kiểm tra đủ tổ hợp ca, mã HTTP, `requestId`, `searchId` và thứ tự sự kiện. Với xuất, đối chiếu `startingState` (dự kiến) với trạng thái đọc qua `export_requires_published` (quan sát). Với xem trước, kiểm tra cả hai giá trị `hasCeiling` của `preview_ceiling`. [Trình xử lý](../../../../src/app.js)

## Môi trường và giới hạn dự kiến

Chạy `npm.cmd test`, khởi tạo schema riêng và dùng `npm.cmd run study -- --out nghien-cuu/ket-qua/RQ3/20261125-211408-bao-phu/du-lieu-goc` từ `thuc-nghiem/`. Bộ chạy xác nhận phản hồi và thứ tự sản phẩm. Tính lại số liệu từ dấu vết gốc và lưu vị trí sự kiện (chỉ số từ 0) trong bảng bằng chứng.

Bộ ca cố định và dữ liệu mẫu giới hạn phạm vi suy luận. Vị trí quan sát đặt tại ranh giới driver sau khi câu lệnh thành công. Fixture tái tạo trạng thái tại thời điểm yêu cầu, còn chuỗi kiểm tra cả quá trình chuyển trạng thái trên một ID. Hai cách có thể đạt cùng tập vị trí dù kiểm tra các thuộc tính khác nhau của luồng.
