# Sổ tay · phân quyền

Gồm      : `luoc-do/11-quyen-he-thong.sql` — bảng `tai_khoan`, hai cờ · `13-quan-ly-thanh-vien.sql` — `co_the_quan_tri` · `la_chinh_minh` · `la_chu_cay` · `14-loi-moi.sql` — mời vào cây · `16-thung-rac-cay.sql` — xoá cây · `18-hai-chu-ky.sql` — vá bốn cửa · `21-de-xuat-gan-nguoi.sql` · `23-bon-luat-moi.sql` — **bản đứng CUỐI của 13 hàm**
Liên quan: `THIET-KE-NHIEU-CAY.md` mục 11 · `DU-LIEU.md` mục 2 · `HUONG-DAN-PHAN-QUYEN.md` · bàn thử: `../kiem-thu/ban-thu-sql/do-b102`→`do-b118b`

## Luật chung

- **Bốn hạng, đừng gộp**: Quản trị hệ thống = cờ `tai_khoan` · Chủ cây = cột
  `trees.chu_so_huu` · Quản trị gia phả = `tree_members.role='quan_tri'`, **chỉ
  sửa + duyệt nội dung, KHÔNG đổi quyền** · Được dựng cây = cờ `duoc_tao_cay`,
  **không mẩu quyền nào** trên cây đang có.
- **Không ai đặt quyền cho chính mình.** Mọi cửa đổi quyền hỏi `la_chinh_minh()`.
- **Từ b94, admin duyệt là hàng rào THẬT; luật trực hệ chỉ còn là bộ lọc** giúp
  admin đỡ phải đọc những đề nghị chắc chắn bị từ chối. Câu này hay bị mô tả
  ngược — đừng viết ngược lại.
- **Hàm gác cửa viết dạng KHẲNG ĐỊNH và bọc `coalesce(…, false)`.** Không có
  dòng thì `select` trả `null`, và `null` trong `and`/`or` cho ra `null` chứ
  không cho ra `false`. Lỗ leo quyền 04/09 sinh ra đúng từ đó, 57 phép kiểm báo
  xanh suốt.
- **Vá tại chỗ (đọc `pg_get_functiondef` → thay → `execute`): neo bằng biểu
  thức chính quy chịu khoảng trắng, và câu DỪNG in đoạn mã đang chạy.** `62`
  neo nguyên văn: bàn thử khớp 1, máy THẬT khớp 0 (30/09) — bản trên máy thật
  khác chữ mà không ai biết khác ở đâu. Bàn thử dựng từ file, máy thật mang
  lịch sử dán; neo nguyên văn là đặt cược rằng hai bên giống nhau từng dấu cách.
- ⚠⚠ **NGOÀI thân hàm không được có chữ in-to liền + một tên** — trong khối
  `do $$`, trong câu `select` thường, và KỂ CẢ trong chuỗi chữ / mẫu tìm
  (`'insert in-to public[.]…'`). SQL Editor của Supabase rà văn bản SAU khi
  chạy, tưởng câu ấy tạo bảng tên đó, đi hỏi RLS → màn hình báo *"relation
  "public" does not exist"* dù file ĐÃ CHẠY XONG và đã lưu, và không hiện
  kết quả. Dán `62` (30/09) và hai câu chẩn đoán đều dính. Trong thân `create
  function … $$` thì không sao (`60`, `61` có). Dùng `x := (select …)`; mẫu
  tìm viết `i[n]to`. Câu báo nêu tên lạ, không CONTEXT = dấu hiệu.
- **`drop function` xoá cả `grant`.** Dựng lại hàm đã có thì chép theo cả dòng
  `grant`, không thì nó rơi về mặc định Postgres *ai cũng gọi được, kể cả `anon`*.
- **`05` phải đứng TRƯỚC `06`.** `05` đặt lại ràng buộc vai **thiếu `quan_tri`**
  (nó có trước khi vai ấy ra đời), `06` mới thêm vào. Đảo hai file là tự tay bỏ
  vai quản trị viên khỏi danh sách hợp lệ.
- **Dán lại riêng `06` hay `07` sẽ âm thầm mở rộng `quan_tri` trở lại** — `08`
  mục 8 định nghĩa lại ba hàm của hai file ấy cho hẹp hơn. Dán lại chúng thì dán
  lại cả `08`, rồi `18`, rồi `23`.
- **`23` đứng CUỐI mọi chuỗi dán lại.** Dán lại `11`/`14`/`16`/`18`/`20` mà quên
  `23` là mở lại khoá mềm, mở lại lời mời QTHT thành quyền thật, mở lại cây đã
  xoá — cả ba đều **im lặng**.

### Chuỗi dán lại — bản DUY NHẤT

Dán lại file bên trái thì phải dán tiếp các file bên phải, đúng thứ tự:

- `11`/`10`→`14`→`16`→`18`→**`23`** · `13`/`14`→`15`→`20`→**`23`** · `08`→`18`
  · `08`/`10`→**`43`** (bản cuối `ds_kiem_duyet()`)
- `21`/`13`/`18`/`27`→**`29`** — `29` giữ bản cuối của `duyet_de_xuat_gan()`
  (nay `39` đè). `gan_nguoi_cho_thanh_vien()` đã BỎ ở `62`.
- ⚠ **`14`/`15`/`18`/`27`/`28`/`29`/`32`/`48`/`52` → `62`**: `62` giữ bản cuối
  `tim_tai_khoan()` · `tim_nguoi_trong_cay()` · `moi_vao_cay()` ·
  `duyet_thanh_vien()`, VÁ TẠI CHỖ `tu_choi_thay_doi()` · `gop_hai_nguoi()`,
  và xoá `gan_nguoi_cho_thanh_vien()`. Quên `62` là hàm ấy đọc/ghi lại cột
  chết `tree_members.person_id` — ô tìm hiện người cũ, duyệt đơn "gắn" mà
  không gắn, gộp người vấp chỉ mục. Im lặng. (`52`→`62`: vá của `62` neo
  trên bản đã có `contact`.) ⚠ Sau `63` (cột đã xoá): dán lại `06`/`15`/`27`
  báo lỗi to tiếng; các file kia dựng lại hàm im lặng rồi hỏng lúc chạy —
  vẫn dán `62` ngay sau.
- `03`/`06`/`08`/`13`→`25`→`27`→`28`→**`32`** — `28` giữ bản cuối của
  `tu_choi_thay_doi()` (khác `27` chín chỗ: dán lại `27` sau `28` là mất cả
  chín, **không một lời báo**); ⚠ **`32` giữ bản cuối của `luu_cay()`** (rào
  cây thép) — dán lại `27`/`28` sau `32` là mở lại lỗ, im lặng.
- `26`/`27`/`30`→`47`→`50`→`51`→`52`→**`53`** (`50` giữ bản cuối
  `ds_hon_nhan_xem_duoc()` · luật `doc_change_log`; `52` giữ bản cuối
  `che_nguoi()` · luật `doc_tree_persons`; **`53` giữ bản cuối `doc_cay()` ·
  `ds_nguoi_xem_duoc()` · `ds_nguoi_bi_che()` · `doc_ho_so_nguoi()`**)
  — quên `47` là khách đọc lại MỌI trường; quên `50` là người chỉ xem đọc lại
  chi tiết người còn sống; quên `51`/`52` là khách thấy lại trường chính chủ
  đã tắt, và đọc lại Đời qua `tree_persons`; quên `53` là người chỉ xem thấy
  lại trường chính chủ đã tắt. Cả năm im lặng.
- ⚠ **`26` → `56`**: `26` cấp `select` CẢ BẢNG `tree_persons` — dán lại `26`
  mà quên `56` là mọi thành viên đọc thẳng lại được cột Đời, im lặng.
- ⚠ **`28`/`32`/`48` → `52`**: `52` VÁ TẠI CHỖ `tu_choi_thay_doi()` ·
  `luu_cay()` · `gop_hai_nguoi()` (thêm `contact`). Dán lại một trong ba mà
  quên `52` là ô Liên hệ thôi lưu / thôi trả lại / thôi gộp — im lặng.
  ⚠ Rồi **`→ 69`**: `69` vá tại chỗ `luu_cay()` (người đầu tiên lấy từ cây
  khác). Dán lại `32`/`52` mà quên `69` là lỗi ấy quay lại — im lặng.
- ⚠ **`02` định nghĩa `doc_change_log` bản rộng** — dán lại `02` (vốn đã cấm
  sau `26`) là mở lại `change_log` cho người chỉ xem.
- **Sau `26` KHÔNG dán lại `02`/`11`** — luật đọc trên bảng người của chúng hỏi
  `tree_id` đã bỏ; bản đứng cuối của bốn luật ấy ở `26` mục 5.
- `34`→`35`→`36`→`37`→`38`→`39`. `36` giữ bản cuối của
  `gan_nguoi_tai_khoan()`; ⚠ `39` giữ bản cuối của `duyet_de_xuat_gan()` ·
  `ds_de_xuat_gan()` · `de_xuat_gan_cua_toi()` — dán lại `35`/`36` là PHẢI dán `39`.

### File phụ thuộc cột mới phải tự chặn khi dán sai thứ tự (26/09)

Dán `37` trước `34` thì Postgres chỉ nói *"column … does not exist"*; dòng
*"Chạy SAU …"* không ai đọc lúc dán. Nay `35`/`36`/`37` mở đầu bằng khối
`do $$` hỏi thứ mình cần, thiếu thì `raise` câu tiếng Việt chỉ file phải dán
trước — trong `begin`, cả file lùi. Đo: `do-b126c.mjs` Q1–Q5.

### Đổi "một cây một đơn" thành "một tài khoản một đơn" đụng dữ liệu CŨ (26/09)

Dán `35` lên THẬT gặp `23505` khi tạo chỉ mục "một tài khoản một đơn chờ":
đời trước mỗi CÂY một đơn riêng, nên một tài khoản từng nộp ở hai cây đang
giữ hai đơn cùng `trang_thai='cho'` — hợp lệ ở luật cũ, phá luật mới. Bàn
thử không bắt được vì nó dựng từ dữ liệu TRỐNG. Chữa: `truncate table
de_xuat_gan_nguoi;` trước khi dán lại — an toàn, đơn kiểu cũ chưa mang nghĩa
toàn phần mềm. Rút ra: hẹp PHẠM VI một chỉ mục unique (cây → tài khoản) phải
hỏi trước "dữ liệu cũ có phạm luật mới không", không hỏi thì lộ ra lúc dán.

## Nới hẹp luật tự duyệt — `29` (b124c, 23/09/2026)

Luật mới, một câu: **người nộp đơn gắn mã cho chính mình tự duyệt được khi và
chỉ khi họ đã là chủ cây, hoặc `quan_tri` của chính cây ấy.** Mọi ca khác —
gồm QTHT ở cây họ chưa có vai — vẫn cần chữ ký thứ hai. Lý lẽ và ba hướng đã
cân: `THIET-KE-NHIEU-CAY.md` 11.10.

- Hàm mới `la_quan_tri_cay(p_tree, p_user)` đọc thẳng `trees.chu_so_huu` +
  `tree_members`. ⚠ **KHÔNG được hỏi `vai_tro()`**: nó trả `'quan_tri_he_thong'`
  ở nhánh ĐẦU TIÊN, nên một QTHT không có chân trong cây vẫn "là quản trị cây
  ấy" — đúng cái nhầm 11.10 cảnh báo, và nó bỏ chữ ký thứ hai ở MỌI cây.
- Phải nới **cả hai lớp**: `duyet_de_xuat_gan()` (cửa thứ tám) và
  `gan_nguoi_cho_thanh_vien()` — cửa thứ tám cố ý đi qua hàm sau, nới một lớp
  là hỏng nửa vời, kèm câu từ chối nói về chuyện khác. *(Từ `39` cửa thứ tám
  đi qua `gan_nguoi_tai_khoan()`; `gan_nguoi_cho_thanh_vien()` bỏ ở `62`.)*
- `tu_choi_de_xuat_gan()` **không** nới: tự rút đơn đã là đường có sẵn.
- Trình duyệt hỏi `sb.laQuanTriCay()`, KHÔNG suy từ `coTheQuanTri()` — hàm ấy
  bật cho cả QTHT.
- ⚠ **Nhánh `quan_tri` chưa với tới được**, nói thẳng: hai hàm vẫn mở đầu bằng
  `co_the_quan_tri()`, mà hàm ấy chỉ nhận QTHT hoặc chủ cây. Giữ nhánh là giữ
  đúng câu đã chốt và giữ sẵn cho ngày `co_the_quan_tri()` được nới — **đừng
  viết vào báo cáo rằng nó đã đo**. Muốn quản trị gia phả xét được đơn gắn mã
  là một việc KHÁC, chưa chốt. Đo: `do-b124c.mjs` B6b.
- ⚠ **`21` không dán lại một mình được nữa** (đo 23/09): `ds_de_xuat_gan()` của
  nó còn nối `persons.tree_id`, cột `26` đã bỏ — lỗi to tiếng, `27` là chỗ vá.
  Bài đo dựng lại ĐÚNG MỘT hàm bản cũ thay vì dán lại cả file.

## Giấu người còn sống với người chỉ xem — `50` (b148, 28/09/2026)

Luật chốt: vai `xem` của cây ấy (không phải chủ cây, không phải QTHT) thấy
người còn sống chỉ còn họ tên · giới tính · năm sinh. "Còn sống" =
`coi_con_song()`: ô Còn sống bật + không dấu vết đã mất (ngày/nơi mất, an
táng, giỗ) + sinh chưa quá 100 năm hoặc không rõ năm.

- **Ba đường đọc phải khép CÙNG NHAU** — `doc_cay()` che, `ds_nguoi_xem_duoc()`
  bỏ dòng (kéo theo `persons` · `media` · `unions`), `doc_change_log` bỏ cây
  chỉ xem (`diff`/`truoc` chứa nguyên bản ghi). Thiếu một là tấm rèm.
- **Được thấy đủ nếu có đường khác**: có vai khác `xem` ở một cây chứa người
  ấy, hoặc là chính mình (`tai_khoan.person_id`) — `ds_nguoi_xem_day_du()`.
- App hỏi `bi_che` (danh sách mã máy chủ đã che), KHÔNG hỏi `p.living`: cụ 1850
  mang `living` bật mà không bị che.
- ⚠ **Đường nào đọc thẳng bảng người là mất người còn sống** (RLS bỏ dòng,
  không có bản che). Trang hồ sơ (`docGiaDinhNguoi`) vì thế đi qua
  `doc_ho_so_nguoi()`. Thêm màn hình mới đọc thẳng `persons` thì phải hỏi câu
  này — `docNguoiTheoMa` (form sửa) không cần, người chỉ xem không vào form ấy.
- Hôn nhân có vợ/chồng bị che: xoá trắng ngày/nơi cưới + ghi chú, giữ tình
  trạng (`che_hon_nhan`); đọc thẳng `unions`/`union_children` thì không thấy
  dòng ấy (`ds_hon_nhan_xem_duoc` bản `50`).
- ⚠ **Chỉ che cho người KHÔNG Lưu được.** `doc_cay()` che khi người gọi chỉ
  xem CÂY ẤY; che cho người sửa được là mời họ Lưu bản trắng đè dữ liệu thật.
  Trang hồ sơ chỉ đọc nên che theo `ds_nguoi_bi_che()` toàn phần mềm.
- Chưa che: `sources`. Đo: `do-b148a.mjs` 57/57.

## Thông tin công khai của tôi — `51` (b150, 28/09/2026)

Mỗi tài khoản chọn nhóm trường về NGƯỜI MÌNH ĐƯỢC GẮN mà khách của một cây
thấy. Khách thấy = nhóm cây bật (`47`) ∩ nhóm người bật. Chỉ che KHÁCH.

- ⚠ **Cài đặt nằm trên `tree_members`, KHÔNG trên `tree_persons`/`persons`**:
  `gop_hai_nguoi()` (`48` mục 5) xoá dòng `tree_persons` của mã thua rồi chèn
  lại trần — cài đặt để ở đó là MẤT khi gộp, và mất theo hướng LỘ.
- Người có mặt ở cây này mà tài khoản gắn với họ không ở cây này (xuyên cây,
  vành đai): lấy phần GIAO mọi cài đặt đã đặt — chặt nhất.
- `truong_rieng_nguoi()` khoá kín với `authenticated`; chỉ `doc_cay()` gọi.
- Đo: `do-b150.mjs` 33/33.
- **Mười nhóm từ `52` (b150b)**: thêm song_mat · doi · que_quan (tách khỏi
  tieu_su) · lien_he. Tắt song_mat → `living: null` + ngày mất cũng ẩn.
  ⚠ Đời có đường đọc thứ hai (`tree_persons`, app đọc thẳng) — che ở
  `doc_cay()` phải kèm khép luật đọc bảng ấy với khách, không là tấm rèm.
  Đo: `do-b150b.mjs` 32/32.
- **Áp cả cho vai `xem` từ `53` (b152, 29/09/2026)**: vai `xem` thấy = nhóm
  NGƯỜI bật, KHÔNG giao nhóm cây (nhóm cây là cho khách); người còn sống thì
  giao thêm `c_mo_song` của `50`. Có đường thấy đủ (`ds_nguoi_xem_day_du()`)
  thì không che. Ba đường khép cùng nhau như `50`: `doc_cay()` ·
  `ds_nguoi_xem_duoc()` (→ `persons`/`media`) + `ds_nguoi_bi_che()` (→
  `unions`) · `doc_ho_so_nguoi()` (cài đặt chặt nhất — `truong_rieng_nguoi(mã,
  null)` = giao mọi cây). ⚠ `bi_che` của `doc_cay()` VẪN chỉ kể người còn
  sống (app nói "còn sống nên lược bớt"). Đo: `do-b152.mjs` 29/29.
- **Khép cột Đời từ `56` (b158)**: `authenticated` thôi đọc cột
  `tree_persons.doi` (quyền THEO CỘT — chỉ `tree_id` · `person_id`); Đời chỉ
  đi qua `doc_cay().doi` · `doc_doi_cay()` (= đúng phần ấy của `doc_cay`, gọi
  thẳng, không chép luật) · `doc_ho_so_nguoi().cay`. Không giấu DÒNG nên mọi
  chỗ hỏi "người này ở cây nào" chạy như cũ. ⚠ Cột mới thêm vào
  `tree_persons` thì `authenticated` KHÔNG tự đọc được. Đo: `do-b158.mjs` 22/22.
- **Đo trên máy THẬT bằng REST (b156, 29/09)**: b148 7/7 (`khach` vai `xem` ở
  cây 681 · 374 người bị che) · b152 9/9 (`thu-h9` tắt nhóm giới tính ở
  `TH957`). Hai bẫy khi tự viết phép đo: tắt `gioi_tinh` cho `sex='U'`, KHÔNG
  rỗng · `dat_cong_khai_tai_khoan(p_truong null)` = TẮT HẾT, không phải "về
  chưa đặt" — hoàn tác thì gửi đủ mười nhóm.

## Bài học

### Gốc phạm vi trực hệ phải THUỘC CÂY (b122a)

`pham_vi_sua()` bản `06` nhận `p_goc` vô điều kiện — an toàn khi khoá ngoại
`(tree_id, person_id)` của `tree_members` bảo đảm gốc nằm trong cây. `26` bỏ
khoá ấy, nên gốc trỏ sang người cây khác lọt vào phạm vi sửa từ cây này. `27`
chữa: `pham_vi_sua` gốc ngoài cây → rỗng; bốn cửa gắn mã hỏi `tree_persons`.
⚠ Bỏ một khoá ngoại là phải tìm mọi hàm từng dựa vào nó — `moi_vao_cay` từng
lọt khỏi danh sách 20 hàm của b121. Đo: `do-b122.mjs` L9 · G1–G5.

### Luật đọc gọi hàm cho TỪNG DÒNG là chậm — viết `cột in (select ds_…())`

Hàm `security definer` viết bằng SQL không được Postgres gộp vào câu truy vấn,
nên `using (co_the_xem_cay(tree_id))` lập kế hoạch lại mỗi dòng (~8ms trên bàn
thử). Bản đầu của `26`: đọc cây 740 người 11 giây, luật hôn nhân nối bằng `or`
treo **15 phút** — đúng kết quả, bảng tự kiểm vẫn 8/8. `26` chữa bằng hàm trả
DANH SÁCH (`ds_cay_xem_duoc`…): không phụ thuộc dòng, tính một lần mỗi câu →
1,2 giây. ⚠ Bảy luật của `11` vẫn gọi từng dòng, chưa đo.

### Một nới ở hàm nền móng chỉ an toàn nhờ một hàng rào ở ĐẦU KIA

`23` thêm `not bi_khoa()` vào `la_thanh_vien()` — đúng hàm mà `16` dặn *"đừng
động vào"*, vì bản sao lưu đêm đi qua nó. Thêm được là nhờ **`khoa_tai_khoan()`
từ chối khoá tài khoản mang vai `sao_luu`**: máy sao lưu không bao giờ bị khoá
nên mệnh đề mới vĩnh viễn không chạm tới nó.

⚠ Hai thứ ấy là **một cặp**. Ai bỏ hàng rào `sao_luu` ở `khoa_tai_khoan()` sau
này sẽ mở lại lỗ hổng b102 ở một file khác, cách đó 400 dòng: bản sao lưu đêm
vẫn chạy, vẫn sinh file, vẫn đủ chín bảng, chỉ là rỗng. Bàn thử canh bằng Q5 +
Q6 của `do-b118b.mjs` — **phải chạy cả hai**, Q5 một mình không nói gì.

### Phép "không tắt người cuối cùng" phải TRỪ người đang bị đụng ra

Đếm `count(*) where la_quan_tri_he_thong = true` mà KHÔNG trừ chính người sắp
bị hạ cờ thì cộng với khoá mềm sinh ra từ chối SAI (QT1 khoá QT2, muốn hạ nốt
cờ QT2 thì đếm ra 1 và chặn, dù hạ xong vẫn còn QT1). `so_qtht_dung_tru(p_user)`
chữa (`do-b118b.mjs` Q8) — nhánh ấy hôm nay chưa với tới được (người gọi không
trỏ vào chính mình), giữ nó là đai an toàn cho sau này, chưa phải hàng rào đã đo.

### Bảng tự kiểm cuối file SQL cũng hỏng được, và nó hỏng theo hướng tệ

`information_schema.columns` **không liệt kê cột trả về của hàm trả bảng** (0
dòng). Phép 13 của `23` vì thế báo **HỎNG khi hàm đúng** — phép kiểm sai đẩy
người đọc đi sửa thứ không hỏng. Đếm cột hàm trả bảng bằng `pg_proc.proallargtypes`.

Cùng họ với bài học `14` mục 7 *(bảng tự kiểm 5/5 ĐẠT che một hàm hỏng hẳn vì
nó chỉ hỏi "hàm có tồn tại không")*: **bảng tự kiểm hỏi hình dạng, bàn thử hỏi
hành vi.** Không cái nào thay được cái nào.

### Hai chữ ký thi hành bằng HÌNH DẠNG DỮ LIỆU, không bằng mệnh đề

Lỗ hổng b110c thủng ở bốn cửa một lúc vì luật *"lời mời chưa nhận không mang
quyền"* nằm ở bốn mệnh đề `if` rời nhau, và bốn chỗ ấy đều quên được.

`23` đặt lời mời QTHT ở **hai cột riêng** (`qtht_moi_luc` · `qtht_moi_boi`),
tách hẳn khỏi cờ thật `la_quan_tri_he_thong`. Nên `la_quan_tri_he_thong()` vẫn
chỉ đọc đúng một cột như cũ và **không có đường nào** để một lời mời lọt vào
đó — không phải nhờ ai nhớ viết thêm một mệnh đề. `do-b118b.mjs` Q14a–Q14e đo
đúng câu ấy.

### Khoá mềm: không đẻ cột `khoa_den`

60 ngày là một **phép tính** trên `khoa_luc`, y như `16` không giữ cột "ngày dọn
được". Hai chỗ ghi cùng một hạn là hai chỗ để lệch nhau, và chỗ lệch ấy không ai
đọc ra bằng mắt. ⚠ Và hết 60 ngày **không tự mở khoá** — khoá đứng tới khi có
người mở tay hoặc xoá hẳn; 60 ngày chỉ là lúc cánh cửa xoá hẳn mở ra. Chặn đăng nhập: `46`.

### Đổi luật ở SQL là đổi hành vi của nút đang chạy, không phải lỗi

`23` giữ tên `xin_xoa_cay()` · `huy_xin_xoa_cay()` nhưng đổi hẳn nghĩa *(tên
đã đổi thành `xoa_cay()` · `tra_lai_cay()` ở `60`, b161c — thân giữ nguyên)*, và
`dat_quan_tri_he_thong(x, true)` nay **không bật cờ nữa** — nó gửi lời mời.
Màn hình cũ đọc `ok:true` rồi vẽ *"đã bật"* là **nói dối**, và không có gì báo
lỗi. Bảng bốn nút ấy nằm ở mục `b118c` của `KE-HOACH.md`; dán `23` lên máy chủ
THẬT trước khi làm b118c là tự tay dựng ra bốn màn hình nói sai.
