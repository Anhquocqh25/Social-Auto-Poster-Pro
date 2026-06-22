# Hướng dẫn sử dụng cá nhân — Social Auto Poster Pro

> Ngôn ngữ chính: **Tiếng Việt**  
> Phạm vi hiện tại: sử dụng cá nhân hằng ngày với **safe mode mặc định**, có thể thực hiện **một lần controlled real publish** khi bạn tự bật cờ đúng cách và chấp nhận rủi ro thủ công.

---

## 1. Cài đặt và chạy ứng dụng

### Yêu cầu
- Node.js phù hợp với môi trường hiện tại của dự án
- npm
- Máy Linux để dùng trực tiếp artifact Linux đã build hoặc chạy từ source

### Chạy từ source
```bash
npm ci
npx prisma generate
npm run dev
```

### Build ứng dụng
```bash
npm run build
```

Artifact Linux hiện dự án có thể tạo:
- `release/linux-unpacked/`
- `release/Social Auto Poster Pro-0.1.0.AppImage`
- `release/social-auto-poster-pro_0.1.0_amd64.snap`

### Safe mode mặc định
Ứng dụng phải mặc định ở trạng thái:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Không bật cờ này thường trực cho sử dụng hằng ngày.

---

## 2. Kết nối tài khoản Facebook

Vào trang:
- **Tài khoản Facebook**
- hoặc **Kết nối kênh**

Mục tiêu của bước này:
- kết nối tài khoản Facebook thật qua OAuth
- đồng bộ danh sách Facebook Page mà tài khoản có quyền quản lý
- không hiển thị token thô trong giao diện

Lưu ý:
- app **không** cho xem access token thô
- app **không** cho sửa `.env` ngay trong UI
- app chỉ hiển thị trạng thái an toàn như:
  - connected
  - reconnect needed
  - missing permission
  - ready

---

## 3. Quản lý Connected Channels

Trang **Kết nối kênh** dùng để xem các Page đích hiện có.

Bạn cần kiểm tra:
- tên Page đúng
- avatar Page an toàn hoặc fallback xác định được
- trạng thái readiness là `ready` nếu muốn dùng cho controlled real publish
- avatar tài khoản nguồn khác với avatar Page
- nút:
  - Add Channel
  - Check Connection
  - Reconnect
  - Remove (chỉ xóa cục bộ liên kết trong app)

Điều app **không** làm:
- không giả lập Group support
- không nhấn mạnh default channel như luồng cũ
- không lộ token trong URL avatar

---

## 4. Phân biệt avatar tài khoản và avatar Page

Trong app hiện có 2 lớp nhận diện:

### Avatar tài khoản
- đại diện cho tài khoản Facebook đã OAuth

### Avatar Page
- đại diện cho Facebook Page đích dùng để đăng bài

Quy tắc:
- hai avatar này phải được hiểu là khác nhau
- app cố gắng hiển thị avatar Page an toàn
- nếu không lấy được avatar Page an toàn, app dùng fallback xác định được
- không tạo URL tokenized ở renderer để render avatar

---

## 5. Tạo bài text

Vào trang **Đăng bài viết**.

Luồng đúng:
1. chọn định dạng `Bài viết`
2. chọn kênh đăng rõ ràng
3. không tải media
4. nhập nội dung
5. chọn:
   - `Lưu nháp`
   - hoặc `Lên lịch`
   - hoặc `Đăng ngay`

Nếu safe mode đang tắt real publish:
- `Đăng ngay` sẽ bị chặn đúng sự thật
- app không giả thành công
- app không tạo publish job thật ngoài ý muốn

---

## 6. Tạo bài nhiều ảnh

Với bài nhiều ảnh:
1. chọn `Bài viết`
2. chọn đúng kênh
3. dùng khu vực **Tải media**
4. chọn nhiều ảnh
5. nhập nội dung
6. lưu nháp hoặc lên lịch hoặc kiểm tra trạng thái blocked-safe

Quy tắc:
- nhiều ảnh được phép cho normal post
- không được trộn ảnh và video trong cùng một post
- nếu chuyển từ ảnh sang video, app sẽ yêu cầu xác nhận thay thế

---

## 7. Tạo bài video

Với bài video:
1. chọn `Bài viết`
2. chọn đúng kênh
3. dùng **Tải media**
4. chọn đúng **một** video
5. nhập caption ngắn
6. tiếp tục lưu nháp / lên lịch / controlled publish

Quy tắc:
- chỉ được **một video**
- không được đồng thời có ảnh
- nếu đang có ảnh mà đổi sang video, app hỏi xác nhận
- nếu đang có video mà đổi sang ảnh, app hỏi xác nhận

---

## 8. Vì sao Facebook có thể hiển thị video thành Reels

Ứng dụng hiện theo luồng:

- **Facebook Page video publish**
- **không tuyên bố native/dedicated Reels API support**

Cách diễn đạt đúng:
- **Facebook có thể hiển thị video mới dưới dạng Reels**

Điều này có nghĩa:
- app upload video theo luồng đăng video/Page hiện có
- Facebook có thể tự hiển thị nó như Reels ở phía Facebook
- app không được phép tuyên bố rằng nó dùng API Reels riêng/native

---

## 9. Chuẩn bị Story

App hiện cho phép:
- chọn định dạng `Tin` / `Story`
- chuẩn bị dữ liệu cục bộ
- lưu nháp cục bộ
- lưu trạng thái local để bạn tiếp tục xử lý sau

Điều này hữu ích nếu bạn muốn:
- chuẩn bị nội dung
- gom lịch
- phân biệt post thường với Story trong dữ liệu cục bộ

---

## 10. Giới hạn hiện tại của Story

Hiện tại với kết nối Facebook đang dùng:
- app **không** tuyên bố hỗ trợ real Story publish
- app **không** giả Story bằng luồng Page post/video bình thường
- app **không** fake success cho Story

Khi bạn thử publish Story thật:
- app phải chặn đúng sự thật
- UI phải hiện thông báo unsupported/local-only

---

## 11. Lên lịch bài viết

Bạn có thể:
- tạo post
- đặt `scheduledAt`
- lưu bài ở trạng thái `scheduled`

Hệ thống nội bộ:
- scheduler sẽ quét lịch
- queue sẽ nhận job khi đến thời điểm phù hợp
- startup recovery vẫn được giữ để tránh trạng thái dở dang sau restart

Lưu ý:
- đã publish trên Facebook thì app không remote edit/delete
- queued job chỉ nên hủy khi chưa bắt đầu xử lý

---

## 12. Bulk Create với text / ảnh / video

Trang **Đăng hàng loạt** hỗ trợ local workflow:

### Hỗ trợ
- text-only row
- nhiều ảnh trên một row
- một video trên một row
- chọn `Post` hoặc `Story`
- save local
- review summary
- blocked reasons rõ ràng
- nhập CSV tương thích ngược

### Không hỗ trợ hoặc bị chặn đúng sự thật
- trộn ảnh + video trên cùng một row
- nhiều video trên một row
- Story real execution với Facebook connection hiện tại
- real bulk video publish nếu chưa được xác minh riêng

---

## 13. Hiểu các trạng thái

Một số trạng thái thường gặp:

- `draft` — nháp cục bộ
- `scheduled` — đã lên lịch
- `queued` — đã vào hàng đợi
- `posting` — queue đang xử lý
- `published` — đã xác nhận publish
- `failed` — thất bại
- `blocked` — bị chặn an toàn
- `cancelled` — đã hủy cục bộ
- `needs_verification` — cần xác minh thủ công

Quan trọng:
- `fb_sim_*` **không bao giờ** được tính là success Facebook thật
- provider acceptance chưa đủ bằng chứng cuối cùng thì vẫn có thể phải giữ ở `needs_verification`

---

## 14. Ý nghĩa của `needs_verification`

`needs_verification` nghĩa là:
- app có tín hiệu cho thấy provider đã nhận hoặc dữ liệu local có dấu hiệu không đủ chắc chắn
- nhưng app **không có đủ bằng chứng an toàn** để kết luận `published`

Ví dụ lịch sử đã được bảo toàn:
- post `#6` hiệu lực là `needs_verification`
- post `#26` hiệu lực là `needs_verification`

Quy tắc đúng:
- không ép từ `needs_verification` thành `published`
- kiểm tra thêm trong Diagnostics hoặc trực tiếp trên Facebook

---

## 15. Safe mode

Safe mode là trạng thái mặc định của ứng dụng:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Khi safe mode đang bật:
- Create Post real publish bị chặn
- Bulk real publish bị chặn
- app không gọi provider thật ngoài ý muốn
- app không fake success
- app vẫn cho bạn chuẩn bị nháp, lịch, nội dung local

Safe mode phải là chế độ dùng hằng ngày.

---

## 16. Bật controlled real publish

Chỉ dùng khi bạn thực sự muốn thử **một lần publish thật có kiểm soát**.

### Cách làm đúng
1. xác định nguồn cờ hiệu lực thực tế:
   - `.env.local`
   - `.env`
   - shell
   - hoặc `default_false`
2. bật đúng nguồn đang có hiệu lực:
   ```env
   FACEBOOK_REAL_PUBLISH_ENABLED=true
   ```
3. restart app
4. kiểm tra trong UI / runtime:
   - real publish state = true
   - flag source đúng
   - selected Page readiness = ready
   - không có queued job bất thường

### Lưu ý an toàn
- không bật cờ một cách âm thầm
- không để trạng thái enabled lâu dài
- không thực hiện nhiều lần publish thật liên tiếp
- chỉ dùng đúng **một** candidate khi đang làm controlled test

---

## 17. Khôi phục lại safe mode

Ngay sau controlled real publish, phải trả về:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Sau đó:
1. restart app
2. mở lại Create Post / Bulk Create
3. xác nhận publish thật đã bị chặn lại
4. xác nhận không có provider call ngoài ý muốn
5. xác nhận queue / scheduler khởi động lại an toàn

Đây là bước bắt buộc, không được bỏ qua.

---

## 18. Sao lưu database

Trước mọi controlled real publish:
- tạo backup project files sắp sửa thay đổi
- tạo bản copy riêng của SQLite database hiện tại

Không commit:
- `.env.local`
- database có token thật
- raw token
- private media
- backup local

Nên đặt backup trong thư mục:
```text
_backups/
```

---

## 19. Chuyển sang máy khác

Checklist an toàn cho máy mới:

1. clone repository
2. cài đúng Node.js
3. chạy:
   ```bash
   npm ci
   npx prisma generate
   ```
4. restore database cục bộ hoặc tạo database mới
5. copy `.env.example` thành `.env.local`
6. tự nhập credentials ở máy mới
7. giữ:
   ```env
   FACEBOOK_REAL_PUBLISH_ENABLED=false
   ```
8. chạy kiểm tra:
   ```bash
   npx tsc --noEmit
   npm run build
   npm run dev
   ```

Không bao giờ commit credentials thật vào Git.

---

## 20. Troubleshooting

### App không cho Publish Now
Kiểm tra:
- safe mode có đang bật không
- đã chọn kênh rõ ràng chưa
- media có hợp lệ không
- Story có đang đi vào luồng unsupported không

### Không thấy Page đúng
Kiểm tra:
- tài khoản đã OAuth lại chưa
- trang Connected Channels có readiness đúng chưa
- có cần `Reconnect` hoặc `Check Connection` không

### Video không được chấp nhận
Kiểm tra:
- đúng 1 file MP4 nhỏ chưa
- không có ảnh đi kèm
- caption có quá dài hay chứa nội dung nhạy cảm không

### Bài ở `needs_verification`
Đây không phải lỗi giả.
Nó có nghĩa:
- app chưa đủ bằng chứng để kết luận published
- hãy mở Facebook Page bình thường để kiểm tra thủ công
- không tự sửa dữ liệu để biến nó thành success

### Bulk row bị chặn
Kiểm tra:
- thiếu channel
- trộn ảnh/video
- nhiều video
- Story real execution
- file media không tồn tại

### Lo ngại lộ token
Kiểm tra:
- app hiện không có token viewer
- UI bình thường không được hiển thị raw token
- không chụp/log lại URL có chứa token
- không chia sẻ database local có credentials thật

---

## Ghi chú an toàn cuối cùng
Ứng dụng này được hoàn thiện theo nguyên tắc:
- **không fake success**
- **không coi `fb_sim_*` là Facebook success thật**
- **không remote edit/delete nội dung Facebook**
- **không fake Story support**
- **không tuyên bố native Reels API support**
- **safe mode phải là mặc định sử dụng hằng ngày**