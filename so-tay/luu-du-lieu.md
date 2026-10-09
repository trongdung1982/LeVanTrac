# Sổ tay — LƯU DỮ LIỆU CÂY (thêm cột · `luu_cay` · hoàn tác)

*Lập 17/09/2026 (b120). Ghi theo chức năng — gặp lỗi thì thêm vào đây.*

## Thêm một cột vào bảng người (hay bảng dữ liệu cây nào khác)

Cột mới phải có tên ở **BỐN chỗ**. Thiếu chỗ nào thì hỏng **im lặng**:

| Chỗ | Thiếu thì |
|---|---|
| `js/services/hinh-dang.js` — `TEN_PERSON` + `MAC_DINH_PERSON` | mỗi lần lưu ghi `null` đè lên (`DU-LIEU.md` điều 7) |
| `js/domains/person.js` — `updatePerson()` (+ `createPerson()`) | ô trong form sửa không ăn — hàm chỉ ghi trường nó biết tên |
| `luu_cay()` — danh sách `on conflict do update set …` | người MỚI lưu được, người ĐÃ CÓ sửa không ăn |
| `tu_choi_thay_doi()` — cùng danh sách ấy | từ chối một thay đổi không trả lại cột ấy |

⚠ **Cột (hay bảng) mới MANG MÃ NGƯỜI** thì thêm chỗ thứ năm: `gop_hai_nguoi()`
mục 5 (`luoc-do/48`) — không thì gộp hai người để lại mã thua ở đó, im lặng
(`so-tay/nguoi-xuyen-cay.md` mục *Báo trùng + gộp*). **Máy canh việc này**:
`node kiem-thu/ban-thu-sql/do-gop-quet.mjs` (ngoài repo) dựng chuỗi tới file
số lớn nhất, báo HỎNG nếu cột tên có `person`/`nguoi` hoặc chứa mã `P####`
chưa nằm trong danh sách gộp. Chạy nó sau mọi file SQL thêm cột. Hiện còn
**12 chỗ** — danh sách 13 ở đầu `48` cũ: `tree_members.person_id` bỏ ở `63`.

⚠ Hai hàm máy chủ **liệt kê tên cột**, không `set *`. Bẫy thứ ba và thứ tư tìm ra
ở b120, trước đó tài liệu chỉ ghi bẫy thứ nhất. Bản đứng cuối: `luu_cay()` ở
`32`, `tu_choi_thay_doi()` ở `28` — cả hai đã được `52` vá thêm `contact`.

**Cách `52` (b150b) thêm cột `contact`, dùng lại được:** không chép lại ba hàm
400–500 dòng mà **vá tại chỗ** — đọc `pg_get_functiondef`, thay đúng MỘT chỗ
neo, `execute` lại (`create or replace` giữ `grant`); neo khớp ≠ 1 lần thì
`raise`, cả file lùi. Cột CHO null và cập nhật bằng
`coalesce(excluded.contact, cũ)`: tab chưa Ctrl+F5 và ảnh chụp `change_log`
cũ không mang khoá ấy — `not null` thì hỏng, còn gán thẳng thì xoá trắng.
⚠ Dán lại `28`/`32`/`48` là mất bản vá → phải dán lại `52`.

## Khoá vắng mặt trong JSON gửi lên

`jsonb_populate_recordset` biến khoá thiếu thành `null`, không thành `default`.
Hai nguồn gửi dòng THIẾU cột mới: **tab trình duyệt mở từ trước khi đẩy mã**, và
**ảnh chụp `change_log.truoc` chụp trước khi có cột**. Cột `not null` thì cả lần
lưu bị từ chối; điền `''` thì xoá trắng dữ liệu người ta.

Cách `25-noi-ve.sql` làm: ghép giá trị ĐANG CÓ vào trước, khoá gửi lên đè sau —
`jsonb_build_object('noi_ve', coalesce(hn.noi_ve,'')) || e`. Cột mới sau này
làm y hệt, trong một file SQL mới **đứng cuối** của cả hai hàm.

## Chép lại hàm dài vào file SQL mới

Đừng chép tay. Trích nguyên văn bằng script, thay từng chỗ và **bắt khớp đúng 1
lần**. ⚠ `String.replace(cu, moi)` của JavaScript hiểu `$$` trong `moi` thành
một `$` — thân hàm plpgsql hỏng. Dùng `replace(cu, () => moi)`.

## Đo

`kiem-thu/ban-thu-sql/do-b120.mjs` (ngoài repo): lưu một vòng qua `luu_cay()`
rồi đọc lại · dòng thiếu khoá không xoá dữ liệu · từ chối trả đúng giá trị cũ.
`kiem-thu/kiem-hinh-dang.mjs` phép 4 nay đọc cả `add column … not null` ở mọi
file `luoc-do/`, không riêng `01`.

## Chống ghi đè THEO BẢN GHI — `revision` (b121, `luoc-do/26`)

Người dùng chung nhiều cây, nên `trees.revision` (số của một cây) không chặn
được tab cây B đè lên bản vừa sửa từ cây A. Bốn bảng `persons` · `unions` ·
`union_children` · `media` có cột `revision`; trigger `chan_ghi_de_ban_ghi`:

| Gửi lên | Kết quả |
|---|---|
| sửa, `revision` = số đang có | qua, số +1 |
| sửa, số cũ hoặc thiếu (`null`) | `GP409` hint `xungdot` |
| mới, `revision = 0`, mã chưa ai giữ | qua, lưu số 1 |
| mới, `revision = 0`, mã ĐÃ có | `GP409` hint `trungma` |
| lệnh máy chủ KHÔNG nhắc `revision` | qua, số +1 |

⚠ Dòng cuối là lỗ: `on conflict do update set` của `luu_cay()` mà thiếu
`revision = excluded.revision` thì cả cơ chế **im lặng vô hiệu**. Cột
`revision` là chỗ thứ NĂM trong bảng trên đầu sổ — nhưng khác bốn cột kia,
thiếu nó thì không mất dữ liệu mà mất hàng rào.

⚠ Trigger BEFORE INSERT chạy **trước** khi Postgres xét `on conflict`, và
`excluded` mang giá trị SAU trigger — nên trigger không được đặt số cho dòng
sắp đụng mã đã có. Đo: `kiem-thu/ban-thu-sql/do-b121.mjs` phần G.

⚠ **Ngược lại ở `tu_choi_thay_doi()`: KHÔNG đặt `revision = excluded.revision`.**
Ảnh chụp `cu` mang số CŨ — đặt vào là trigger từ chối chính lần hoàn tác. Ở đó
để trigger tự tăng số (b122a).

### ⚠⚠ Và một chỗ nữa ở TRÌNH DUYỆT: đặt lại số sau mỗi lần Lưu (b122b)

`repo.luuCay()` CỐ Ý không nạp lại cây — bản sao vừa gửi chính là thứ máy chủ
vừa ghi. Nhưng trigger đã tăng số của từng dòng, nên bản sao ấy còn mang số CŨ:
**lần Lưu thứ hai liền sau đó bị từ chối**, và màn hình nói *"người khác vừa
sửa"* trong khi không có người khác nào. `hinh-dang.tangSoSauKhiLuu(cay, ops)`
đặt lại, suy thẳng từ hai luật của trigger (mới `0` → `1`; đang có → `+1`), nên
không tốn thêm vòng mạng nào. Đo: `kiem-hinh-dang.mjs` phép 5, có kiểm chứng
ngược — bỏ bước này thì lượt sau PHẢI hỏng.

## Hoàn tác XUYÊN CÂY — `dung_do_sau()` không đủ (b122a)

`dung_do_sau()` chỉ so nhật ký cùng cây. Ông X sửa tiếp từ cây A thì từ chối lần
lưu cũ ở cây B vẫn dán đè — bàn thử T2 bắt được. `luu_cay()` nay ghi
`truoc.rev_sau` (số từng bản ghi NGAY SAU lần lưu); `ban_ghi_lech_so()` so với
số hiện tại, lệch là từ chối. Cộng: nhật ký cũ hơn `doi_ma_toan_cuc.luc` bị từ
chối (ảnh chụp mang mã cũ). Đo: `do-b122.mjs` phần T.

## Bản ghi phải THUỘC CÂY đang lưu (b122a)

Mã toàn cục + phạm vi `null` của quản trị = quản trị cây B sửa được MỌI người
trong phần mềm chỉ bằng cách gửi mã. Hàng rào 3b của `luu_cay()` chặn: người ∈
`tree_persons`, hôn nhân có vợ/chồng hay con thuộc cây, ảnh gắn vào hai loại ấy
— áp cho cả sửa, xoá, và kéo người cây khác làm vợ/chồng/con. Xoá người = rút
khỏi cây này; bản ghi chỉ xoá khi không cây nào giữ. Đo: `do-b122.mjs` L3–L11.

## KÉO người cây khác VÀO cây này (b124a) — ⚠ ĐÓNG BĂNG: `nguoi-xuyen-cay.md`

Cửa 3b trên mở hé từ 21/09/2026: kéo được người đã có ở cây khác vào **khi và
chỉ khi** mình xem được ít nhất một cây đang chứa họ. Đi bằng chính `luu_cay()`, không có hàm
ghi thứ hai. **Bốn chỗ phải đi cùng nhau, sót chỗ nào cũng hỏng IM LẶNG:**

1. **3b nới** — chỗ duy nhất kêu to khi sót (`ngoaicay`).
2. **4a/4c: cộng `v_keo_vao` vào `v_pham_vi`** — trực hệ tính trong người ĐÃ
   thuộc cây, nên chính người vừa kéo bị 4a đánh rớt (hoặc hôn nhân vừa khai
   bị 4c), kèm câu *"ngoài trực hệ"* không dính gì tới việc vừa làm.
3. **`insert tree_persons` cho cả `v_keo_vao`** — kéo qua QUAN HỆ mà không gửi
   kèm bản ghi người thì họ đứng trong sơ đồ mà không thuộc cây.
4. **`tu_choi_thay_doi()` cắt `tree_persons` của `v_truoc->'keo_vao'`** — họ CÓ
   bản ghi cũ nên đường hoàn tác xếp vào nhóm *khôi phục*, tức trả họ VỀ cây:
   bấm Từ chối xong người ấy vẫn nằm trong đó.

⚠ `v_keo_vao` phải khởi tạo `'{}'`: `x = any(null)` ra `null`, `not null` cũng
`null`, và cả hàng rào 3b lặng lẽ cho qua tất cả.

Kéo người vào thì **đừng gửi kèm bản ghi người** — chỉ gửi quan hệ; bản ghi ấy
thuộc cây kia, gửi lên là upsert đè. Trình duyệt canh luật này ở
`person-edit.js` (`taoHoacDungNguoi`/`dungNguoiCoSan`).
Đo: `../kiem-thu/ban-thu-sql/do-b124a.mjs`.

**Người ĐẦU TIÊN của cây rỗng** lấy từ cây khác (`69`, 09/10/2026): không bản
ghi, không quan hệ — lần lưu chỉ mang `tree.root_person_id`, nên trước `69` máy
chủ trả `ok` mà cây vẫn 0 người. `69` thêm một nhánh vào `v_keo_vao`: cây rỗng
thì người đặt làm gốc là người kéo vào. Trình duyệt phải `napCay()` sau lần ấy —
bản sao vừa lưu không có bản ghi của họ. Đo: `../kiem-thu/ban-thu-sql/do-nguoi-dau-tien.mjs`.

## Mã toàn cục — xin bằng `cap_ma()`

Mã P/U/M duy nhất toàn phần mềm, không tiền tố cây (b121). Trình duyệt đếm số
lớn nhất trong cây đang mở là cấp trùng mã cây khác → `cap_ma(loai, so)`.
Mã cũ → mới lúc chuyển: `doi_ma_toan_cuc`. `change_log` KHÔNG viết lại —
nhật ký trước `doi_ma_toan_cuc.luc` nói bằng mã cũ của cây ấy.

⚠ **Đếm tại chỗ không chỉ "có thể" trùng, mà trùng MÃI MÃI.** Cây NTB đang có
tới `P0059`; `max + 1` của nó là `P0060`, mã cây Nguyễn Phúc đang giữ. Tải lại
trang rồi thử lại vẫn ra đúng con số ấy — không có đường nào thoát, nên `cap_ma`
là bắt buộc chứ không phải cho chắc.

### Kho mã — đường đi từ máy chủ tới `nextId()` (b122b)

`utils/id.js` giữ một **kho mã**; `services/repo.js` xin theo lô rồi đổ vào
(`napKho`), `nextId()` tiêu dần. Đi vòng thế vì `utils` không được gọi
`services` — và vì `nextId()` là hàm ĐỒNG BỘ, gọi từ trong `domains/`
(`createPerson` · `createUnion` · `createMedia`), nơi không await được gì.

| Lúc nào | Ai gọi |
|---|---|
| mở cây (song song với lần đọc) | `repo.napCay()` → `dayKhoMa()`, chỉ khi `suaDuoc()` |
| sau mỗi lần Lưu | `repo.luuCay()` → `dayKhoMa()`, không chờ |
| thêm hàng loạt | nơi gọi tự `await repo.xinMa(loai, so)` |

⚠ **Lô nhỏ là cố ý** (`KHO_MOI_LO`: P5 · U3 · M3). Sổ đếm Postgres chỉ tiến:
mã xin mà không dùng là mất luôn.

⚠ **Kho rỗng thì `nextId()` rơi về đếm trong cây** — cố ý không ném lỗi: ném
giữa form là mất những gì người ta vừa gõ, còn đếm nhầm thì trigger từ chối
bằng `trungma` và tải lại trang (kho đầy lại) là làm được.

⚠ **Nhập bổ sung (b139):** kho hay là hai lô KHÔNG liền, nên
`capMaHangLoat()` rút MỖI mã khỏi kho, cạn mới tự đếm; trang xin phần thiếu
trước (`xinMaChoLanNhap`). Đo: `../kiem-thu/kiem-cap-ma-nhap.mjs`.

⚠ **Nhập tạo gia phả mới (b151a):** `tronMoi` từng GIỮ mã của file — `P0001`
của file đụng `P0001` của cây NTB → `trungma` ngay lần ghi đầu, mà cây rỗng
đã dựng xong trên máy chủ (mồ côi). Nay MỌI bản ghi mang mã mới từ kho, và
trang xin đủ (`xinMaChoCayMoi`) **TRƯỚC cả lúc dựng cây** — kho không bị xoá
khi chuyển cây. Mã file → mã cây chỉ còn nằm ở sổ nhập (`tree.imports`).
Kho cạn thì đếm từ `P0001` trong cây rỗng = chắc chắn trùng — đừng bỏ bước
xin. Đo: `../kiem-thu/kiem-nhap-cay-moi.mjs` (có cây 681 người).

⚠ **Sổ nhập `imports.source` chỉ nhận `GEDCOM`/`EXCEL`** (`check` ở `01`).
Tới b151b cả hai chế độ nhập gửi `maNguon` = `HEAD.SOUR` thô (`GIAPHA`,
`PAF`…) → máy chủ từ chối CẢ lần ghi; mọi bài kiểm Node vẫn xanh vì không có
cơ sở dữ liệu. Nay qua `loaiFileNhap()`. Bài học: đường nhập phải đo bằng
`luu_cay()` thật — `../kiem-thu/ban-thu-sql/do-b151b.mjs` (681 người: gói
~620 KB, `luu_cay` 0,6–0,9 s với GEDCOM, 1,04 s với file Excel thật `.xlsb`,
trên bàn thử; trần Supabase 8 s → một lần gửi, không chia lô).

## Đọc cây đi qua `doc_cay()`, không đọc thẳng bốn bảng (b122b)

`sb.layDong()` cũ gọi `.eq('tree_id', …)` cho `persons` · `unions` ·
`union_children` · `media`. Bốn bảng ấy không còn cột `tree_id`. PostgREST
không diễn đạt được câu *"hôn nhân nào thuộc cây này"* bằng đường dẫn URL, và
nhét 700 mã người vào một `.in(...)` thì vượt giới hạn URL — nên một hàm máy
chủ (`27` mục 2). Ba thứ còn theo cây (`trees` · `sources` · `imports`) và view
mã nhật ký vẫn đọc thẳng, tất cả chạy song song.

⚠ `doc_cay()` trả `{ok:false, loi}` khi người gọi không xem được cây. In thẳng
câu ấy ra, đừng chế câu khác.

## Bỏ `noiVe` khỏi JS (b122b)

`noiVe` (b120) nối hai bản ghi của cùng một người ở hai cây; từ `26` người ấy
chỉ còn MỘT bản ghi nên không còn gì để nối — đã bỏ hết khỏi JS (`git log`).

⚠ `photo_file_id` của dữ liệu di dời từ Drive có ca chứa MÃ FILE DRIVE, không
phải mã `M…` (bàn thử: NPG `P0553`). Có từ trước `26`, đừng tưởng `26` làm lạc.

### Vì sao phép đếm tại chỗ phải quét cả `changeLog`

App không xoá cứng, nên quét `persons` đã tránh được phần lớn chuyện trùng mã.
Chỗ hở là bản ghi rời khỏi mảng bằng đường KHÁC: sửa tay file JSON trên Drive,
hoặc một lần nhập file thay cả mảng. Dấu vết duy nhất còn lại là `changeLog` —
thứ cố ý không bao giờ cắt bớt. Quét `target` và các KHOÁ của `diff`, **không**
quét `note`: `note` là văn xuôi, một câu bàn về mã tưởng tượng sẽ đẩy bộ đếm
nhảy vọt vô cớ.

## Lưu ngoài repo.js — luu-mot-dong-quan-tri.md

## Ảnh mồ côi = rác — so cả mã HÔN NHÂN (b122a, chốt 17/09)

`don_thung_rac()` (`27`) xoá bản ghi ảnh có `subject_id` không khớp mã người
NÀO **và** mã hôn nhân NÀO, trả file vào `dsAnh` (trừ file còn bản ghi khác
dùng chung), xoá trắng `photo_file_id` trỏ vào nó. ⚠ Ảnh cưới gắn vào `U…` —
so riêng mã người là xoá oan. Đo: `do-b122.mjs` O2 · O5.
