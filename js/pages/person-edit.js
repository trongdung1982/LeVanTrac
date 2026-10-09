// ============================================================
// giapha · js/pages/person-edit.js
// Vai trò  : Form thêm/sửa người, thêm quan hệ, SỬA QUAN HỆ ĐÃ CÓ; và XUẤT
//            LẠI mọi màn hình đã dời sang `form-*.js`
// Lớp      : pages — được phép gọi mọi lớp dưới
// Phụ thuộc: pages/form-nen.js (nền dùng chung), pages/form-{go-noi,xoa,anh}.js,
//            pages/quan-tri/o-goi-y.js, state, domains/{person,union,validate},
//            services/repo, utils/{graph,text,date}, config
// Phiên bản: 1.56.0 · Cập nhật: 09/10/2026 21:32 — người đầu tiên lấy từ cây khác
// Sổ tay   : so-tay/form-nguoi.md (13 luật của form) · so-tay/luu-du-lieu.md ·
//            so-tay/o-goi-y.md · so-tay/nguoi-xuyen-cay.md
// ============================================================
//
// Form HIỆN ĐỦ MỌI Ô kèm chữ mờ gợi ý — ngược thẻ thông tin: thẻ KỂ nên ẩn hàng
// trống, form HỎI nên phải hiện.
//
// ⚠ "luật N" trong file này = luật N của `so-tay/form-nguoi.md` — đọc trước khi
//   sửa. Hay vấp nhất: rà đúng thứ được ghi, trên cây mới (1–2) · một lần Lưu
//   (4) · xoá/gỡ phải kể hậu quả (8–10) · khối Quan hệ chỉ SỬA (11) · câu hỏi
//   chỗ nối nằm TRONG form (13).
// ⚠ Màn hình mới → file `form-*.js` riêng; biến `let` mới → `donDepNguoi()`.

// ⚠ Nền dùng chung (trạng thái `N`, bảng ô `o`, hộp, nút, ô nhập, ghi) ở
// `form-nen.js` từ đợt 7 (b158). Nhập từ `form-*.js` vẫn hai chiều — chúng
// không nhập file này nữa, nhưng file này xuất lại màn hình của chúng.
import { N, o, KIEU_O, KIEU_NUT_CHON, KIEU_NUT_CHAN, KIEU_LOP_PHU, KIEU_HOP,
         TEN_QUAN_HE, closePersonForm, canTroLuu, moHopTrang, moHopChon, moHopBao,
         hienNhan, hienLoiGhi, nutChon, nutChanXoa, gaiTruocChan, veNhan, veNhanO, oChu,
         oNhieuDong, oNgay, khoiNgayCua, docO, veChan, gopRaSoat, ghiBanGhi, tenNguoi, tenTrongCay,
         keTenPartner, tenBanDoiTrongCap, soPartner, moTaCap, maTrangThaiCap, chonCap,
         khoiHoiThuBac, docThuBacNhap, loiThuBacGoSai, xoaThuBacNhap, dangKyDonDep }
         from './form-nen.js';
import { unlink } from './form-go-noi.js';
import { xoaNguoi } from './form-xoa.js';
import { veKhoiAnh, apThayDoiAnh, keThayDoiAnh } from './form-anh.js';
import { state } from '../state.js';
import { updatePerson, createPerson } from '../domains/person.js';
import { createUnion, addChild, addPartner, reorderChildren, thuTuConTheoTuoi,
         updateUnion, updateChildRelation, getParentUnions, getPartnerUnions,
         getSpouses, getChildren, rankCua, timCapTrung } from '../domains/union.js';
import { validateAll } from '../domains/validate.js';
import { luuCay, napCay, suaDuoc, timNguoiMoiCay, docNguoiTheoMa,
         nopDeNghiQuanHe } from '../services/repo.js';
import { ganGoiY, dongNguoiCayKhac } from './quan-tri/o-goi-y.js';
import { buildIndex } from '../utils/graph.js';
import { fullName, coGiaTri, matchesSearch } from '../utils/text.js';
import { parseLooseDate, stampNow } from '../utils/date.js';
import { LOAI_TEN_PHU, nhanLoaiTenPhu, QUAN_HE_CON_NHAN, nhanQuanHeCon, TRANG_THAI_CAP,
         nhanTrangThaiCap } from '../config.js';


// themCon    : { unionId } hoặc { chaMeId }
// themChaMe  : { childId, unionId, gioi }   — unionId rỗng = tạo cặp cha mẹ mới
// themBanDoi : { banDoiId, unionId }        — unionId rỗng = tạo cặp mới
let noiVao     = null;
let daXemThuTu = false;  // đã trả lời câu hỏi thứ tự anh chị em
let sapXepLai  = false;  // câu trả lời ấy có phải "sắp xếp lại theo tuổi" không
let noiCtx     = null;   // chế độ noi: { personId, targetId, loai, unionId }

// b124a — KÉO NGƯỜI ĐÃ CÓ Ở CÂY KHÁC VÀO, chỉ ở bốn chế độ THÊM. Chi tiết:
// `so-tay/luu-du-lieu.md` mục "KÉO người cây khác VÀO cây này".
// Đóng băng 22/09, chủ dự án BẬT LẠI 23/09 để thử `luoc-do/30` — trước b127b
// (thẻ chưa đọc `vanh_dai`) và b127c (chưa chặn khai trùng quan hệ). Tắt = đặt
// `false`, ô tìm không vẽ ra, mọi nhánh chạy như "người mới".
const CAN_KEO_NGUOI_XUYEN_CAY = true;
let nguoiCoSanChon = null;  // { id, ten, cacCay, gioi } hoặc null = người mới
let bocCaNhanKhoa  = null;  // khối Tên→Ghi chú, mờ + khoá khi đã chọn người có sẵn
let khoaGioiGoc    = false; // trạng thái khoá giới tính GỐC của form (themBanDoi)
let gioiGoc        = null;  // giá trị giới tính GỐC, để trả lại khi "Bỏ chọn"

// --- ẢNH ĐẠI DIỆN (bước 28) ---------------------------------------------
//
// ⚠ **Ảnh lên Drive NGAY khi chọn, còn hồ sơ chỉ đổi khi bấm Lưu.** Hai việc
// ấy KHÔNG gộp được: tải ảnh là một lần gọi máy chủ riêng, không đi qua
// `luuCay()`. Hệ quả phải nói ra, và app nói thẳng bằng chữ ngay dưới nút:
//
//   Chọn ảnh rồi ĐÓNG FORM mà không lưu → tấm ảnh vẫn nằm lại trên Drive,
//   chỉ là không ai trỏ tới nó. Vài chục KB, không hỏng gì.
//
// Đường ngược lại — lưu hồ sơ trước rồi mới tải ảnh — tệ hơn nhiều: máy chủ
// nhận hồ sơ xong mà ảnh hỏng giữa chừng thì `photoFileId` trỏ vào một file
// không tồn tại, và ô sơ đồ mang một khoảng trống không ai giải thích được.
// TÊN PHỤ (nửa B của bộ trường thông dụng). `tenPhu` là bản làm việc của form,
// tách hẳn khỏi cây: mỗi mục là { type, goc:{surname,middle,given}, chu }.
let tenPhu    = [];
let khoiTenPhu = null;   // khối chứa các hàng, để vẽ lại một mình nó

// QUAN HỆ (việc 3). Cùng lối với `tenPhu`: form giữ RIÊNG một bản làm việc,
// không đọc ngược từ DOM. Xem ghi chú đầu khối Quan hệ.
let quanHe    = null;


// --- BA HỘP THOẠI KIỂU MY FAMILY TREE (bước 65, 30/08/2026) -------------
//
// Xem luật 13 (sổ tay). Ba bản làm việc, cùng lối `tenPhu` và `quanHe`: form
// giữ RIÊNG tham chiếu tới từng ô, không đọc ngược từ `document`. Lý do y hệt
// `thuBacNhap` — `hienNhan()` xoá sạch `N.khoiKetQua` mỗi lần nó nói một câu,
// và mấy khối này thì vẽ lại được giữa chừng.
//
// `chonChaMe` : { mocId, cacO:[{ma,input}] } — hộp "Cha mẹ là ai?" của thêm con
// `khoiThuBac`: hộp CHỨA ô thứ bậc, để vẽ lại một mình nó khi chỗ nối đổi
// `khoiHon`   : hộp CHỨA ba ô của cuộc hôn nhân, cùng lý do vẽ lại như trên
// `conSanCo`  : [{ personId, unionId, hop, oQh }] — bảng con sẵn có của thêm
//               vợ/chồng. `hop` là ô tích, `oQh` là ô chọn quan hệ đẻ/nuôi.
let chonChaMe  = null;
let khoiThuBac = null;
let khoiHon    = null;
let conSanCo   = [];

// Trạng thái RIÊNG của form người — `closePersonForm()` (nền) dọn nó qua cơ
// chế đăng ký. Thêm một biến `let` ở trên thì thêm một dòng ở đây.
function donDepNguoi() {
  noiVao         = null;
  daXemThuTu     = false;
  sapXepLai      = false;
  noiCtx         = null;
  tenPhu         = [];
  khoiTenPhu     = null;
  quanHe         = null;
  chonChaMe      = null;
  khoiThuBac     = null;
  khoiHon        = null;
  conSanCo       = [];
  nguoiCoSanChon = null;
  bocCaNhanKhoa  = null;
  khoaGioiGoc    = false;
  gioiGoc        = null;
}
dangKyDonDep(donDepNguoi);


/**
 * Bản ghi rỗng để form thêm người có cái mà vẽ ra các ô trống.
 *
 * `living: true` — chủ dự án chốt 18/08/2026 sau lần thử đầu. Người được thêm
 * bằng tay gần như luôn là người đang sống: người đã khuất thì đã có sẵn trong
 * gia phả từ đợt nhập liệu hàng loạt. Ô này vẫn bỏ dấu được bằng một cú chạm.
 */
const NGUOI_TRONG = {
  names: [], sex: 'U',
  birth: { iso: null, raw: '', place: '' },
  death: { iso: null, raw: '', place: '' },
  burialPlace: '', living: true, note: '',
};

const GIOI = [
  { ma: 'M', chu: 'Nam' },
  { ma: 'F', chu: 'Nữ' },
  { ma: 'U', chu: 'Chưa rõ' },
];

/**
 * Mở form sửa hồ sơ một người. Thêm người mới đi bằng `quickAddChild()`.
 *
 * @param {string} personId
 * @param {{onDaLuu?:function(string)}} [xuLy]
 *        `onDaLuu` chạy sau khi máy chủ đã ghi xong, để nơi gọi vẽ lại sơ đồ.
 *        Dùng callback thay vì `import` ngược `tree-view.js` — hai file cùng
 *        lớp `pages`, import vòng tròn thì một trong hai thấy hàm của file kia
 *        là `undefined` tuỳ thứ tự nạp, và lỗi ấy chỉ hiện trên GitHub Pages.
 */
export function openPersonForm(personId, xuLy = {}) {
  const nguoi = personId && state.index && state.index.personById.get(personId);
  if (!nguoi) return;
  moForm('sua', nguoi, null, xuLy);
}

/**
 * Mở form THÊM MỘT NGƯỜI CON.
 *
 * @param {string|{mocId?:string, unionId?:string, chaMeId?:string}} vao
 *        `{ mocId }` — CÁCH GỌI CHÍNH từ bước 65: người mà ta đang thêm con
 *        cho; form tự vẽ khối *"Cha mẹ là ai?"* và người dùng chọn ngay trong
 *        đó. Hai dạng cũ vẫn chạy: mã union để nối thẳng vào, hoặc
 *        `{ chaMeId }` để tạo một union MỘT NGƯỜI trong cùng lần lưu.
 * @param {{onDaLuu?:function(string)}} [xuLy]
 *
 * Nhận cả chuỗi lẫn object: bản khung 15/08 ghi `quickAddChild(unionId)`, và
 * đường ấy vẫn chạy. Chỉ thêm dạng object cho ca người chưa có vợ/chồng — ca
 * rất thường gặp trong gia phả cũ, nơi rất nhiều bà mẹ không còn ai nhớ tên.
 *
 * ⚠ `{ unionId }` KHÔNG vẽ khối chọn cha mẹ, và đó là chủ ý: đường ấy đi từ
 * màn hình *Sửa thông tin gia đình*, nơi người dùng đang đứng trong đúng một
 * gia đình cụ thể. Bày lại một câu hỏi họ vừa trả lời bằng cách mở màn hình ấy
 * là mời họ đổi một thứ không ai định đụng.
 */
export function quickAddChild(vao, xuLy = {}) {
  const nv = chuanNoiVao(vao);
  if (!nv) return;
  moForm('themCon', NGUOI_TRONG, nv, xuLy);
}

/**
 * Mở form THÊM NGƯỜI ĐẦU TIÊN của một gia phả còn rỗng.
 *
 * Chế độ duy nhất KHÔNG nối vào đâu cả, vì chưa có gì để nối. Ba đường thêm
 * người kia đều đi từ một người sẵn có — thêm con, thêm vợ/chồng, thêm cha/mẹ —
 * nên gia phả 0 người trước hôm nay là một cánh cửa khoá từ bên trong: file
 * `taoFileDuLieuMoi()` vừa sinh ra không có cách nào nhập người vào.
 *
 * Người này thành luôn `tree.rootPersonId` — gốc cây ghi trong file. Không
 * hỏi lại: người đầu tiên của một gia phả rỗng thì đằng nào cũng là người duy
 * nhất, và `repo.chonNguoiTrungTam` cần một mã để mở sơ đồ ở lần sau.
 *
 * @param {{onDaLuu?:function(string)}} [xuLy]
 */
export function themNguoiDauTien(xuLy = {}) {
  moForm('themDauTien', NGUOI_TRONG, null, xuLy);
}

/** Đọc và kiểm chỗ nối. Trả null nếu chỗ ấy không có thật trong chỉ mục. */
function chuanNoiVao(vao) {
  const index = state.index;
  if (!index) return null;

  const v = (typeof vao === 'string') ? { unionId: vao } : (vao || {});
  if (v.unionId && index.unionById.has(v.unionId)) return { unionId: v.unionId };
  if (v.chaMeId && index.personById.has(v.chaMeId)) return { chaMeId: v.chaMeId };

  // Dạng `{ mocId }`: chỗ nối CHƯA quyết, khối trong form sẽ quyết. Điền sẵn
  // cặp đầu tiên chứ không để trống — mở form ra mà không nút nào được chọn thì
  // người dùng phải bấm một cái chỉ để về lại đúng ca thường gặp nhất. Người
  // chưa có cặp nào thì chỉ có một câu trả lời, và khối kia tự im.
  // ⚠ Rào thép (b128a): cặp có vợ/chồng ở vành đai KHÔNG được chọn sẵn —
  // thêm con vào cặp ấy là đổi quan hệ của người ngoài cây, máy chủ từ chối.
  if (v.mocId && index.personById.has(v.mocId)) {
    const ds = getPartnerUnions(index, v.mocId).filter((u) => !capCoNguoiNgoaiCay(u));
    return ds.length === 0
      ? { mocId: v.mocId, chaMeId: v.mocId }
      : { mocId: v.mocId, unionId: ds[0].id };
  }
  return null;
}

function moForm(che, nguoi, chonNoi, xuLy) {
  closePersonForm();
  N.xuLyNgoai = xuLy || {};
  N.cheDo     = che;
  noiVao    = chonNoi;

  N.lopPhu = document.createElement('div');
  N.lopPhu.style.cssText = KIEU_LOP_PHU;

  const hop = document.createElement('div');
  hop.id = 'giapha-form-nguoi';   // mốc cho bài kiểm hành vi, xem kiem-noi-go.mjs
  hop.style.cssText = KIEU_HOP;

  hop.append(veDauForm(nguoi));
  hop.append(...veCacO(nguoi));

  hop.append(...veKhoiXoaNguoi(nguoi));

  N.khoiKetQua = document.createElement('div');
  hop.append(N.khoiKetQua);

  const canTro = canTroLuu();
  if (canTro) hienNhan(canTro, true);

  hop.append(veChan(() => luuForm(nguoi), !canTro, laCheDoThem() ? tieuDeForm() : 'Lưu'));

  // Bấm ra ngoài KHÔNG đóng form. Khác thẻ thông tin có chủ ý: thẻ chỉ để đọc,
  // đóng nhầm thì mở lại là xong; form thì đang giữ những gì người ta vừa gõ,
  // và một cú chạm trượt làm mất cả là chuyện không tha thứ được.
  N.lopPhu.append(hop);
  document.body.append(N.lopPhu);
}



// ============================================================
// Các mảng của form
// ============================================================

/**
 * Việc của nút Lưu theo chế độ đang mở. Nằm ở đây, không ở nền: `veChan` của
 * `form-nen.js` nhận hàm này qua tham số để khỏi phải biết tên bốn hàm lưu.
 */
function luuForm(nguoi) {
  if (N.cheDo === 'themCon') handleAddChild();
  else if (N.cheDo === 'themChaMe' || N.cheDo === 'themBanDoi') handleAddNguoiThan();
  else if (N.cheDo === 'themDauTien') handleAddDauTien();
  else handleSave(nguoi);
}

/** Bốn chế độ dựng một bản ghi MỚI. Chế độ 'sua' đọc một bản ghi đã có. */
function laCheDoThem() {
  return N.cheDo === 'themCon' || N.cheDo === 'themChaMe' ||
         N.cheDo === 'themBanDoi' || N.cheDo === 'themDauTien';
}

/**
 * Tiêu đề form. Chế độ thêm cha mẹ nói rõ CHA hay MẸ khi biết — người dùng vừa
 * bấm đúng một trong hai nút ấy, nên tiêu đề nói lại "Thêm cha / mẹ" là làm họ
 * phải kiểm lại xem mình bấm trúng chưa.
 */
function tieuDeForm() {
  if (N.cheDo === 'themCon')     return 'Thêm người con';
  if (N.cheDo === 'themBanDoi')  return 'Thêm vợ / chồng';
  if (N.cheDo === 'themDauTien') return 'Thêm người đầu tiên';
  // Không còn "Thêm cha" / "Thêm mẹ" riêng: từ 20/08/2026 chính ô GIỚI TÍNH
  // trong form là chỗ nói ra điều đó, và tiêu đề không được nói trước một thứ
  // người dùng chưa chọn.
  if (N.cheDo === 'themChaMe') return 'Thêm cha / mẹ';
  return 'Sửa hồ sơ';
}

function veDauForm(nguoi) {
  const dau = document.createElement('div');
  const them = laCheDoThem();

  const tieuDe = document.createElement('div');
  tieuDe.textContent = tieuDeForm();
  tieuDe.style.cssText = 'font-size:19px;font-weight:600';

  const ten = document.createElement('div');
  ten.textContent = them ? moTaChoNoi() : (fullName(nguoi) + '  ·  ' + nguoi.id);
  ten.style.cssText = 'font-size:12px;color:var(--sd-chu-mo,#b3aaa0);margin-top:3px;letter-spacing:.03em;line-height:1.45';

  dau.append(tieuDe, ten);
  return dau;
}

/**
 * Câu nói rõ người con này sẽ được nối vào đâu.
 *
 * Phải nói ra, vì đây là thứ duy nhất người dùng kiểm được trước khi bấm: mã
 * union không hiện ở đâu khác trên màn hình, và nối nhầm cặp thì cái sai nằm im
 * trong dữ liệu cho tới lần ai đó xem sơ đồ quanh đúng người ấy.
 */
function moTaChoNoi() {
  const index = state.index;

  // Chế độ duy nhất không có chỗ nối, nên phải trả lời TRƯỚC phép kiểm dưới.
  if (N.cheDo === 'themDauTien') {
    return 'Gia phả này chưa có ai. Người vừa nhập sẽ đứng giữa sơ đồ, và ' +
           'mọi người sau đó nối vào từ chính họ.';
  }

  if (!noiVao || !index) return '';

  if (N.cheDo === 'themChaMe') {
    if (!noiVao.unionId) {
      return 'Cha / mẹ của ' + tenNguoi(noiVao.childId) +
             ' — app sẽ tạo thêm một cặp cha mẹ mới rồi nối ' +
             tenNguoi(noiVao.childId) + ' vào đó làm con.';
    }
    return 'Cha / mẹ của ' + tenNguoi(noiVao.childId) +
           ' — đứng chung cặp với ' + keTenPartner(noiVao.unionId) +
           '  ·  ' + noiVao.unionId;
  }

  if (N.cheDo === 'themBanDoi') {
    return 'Vợ / chồng của ' + tenNguoi(noiVao.banDoiId) + '.';
  }

  // Chỗ nối chưa quyết — khối "Cha mẹ là ai?" ngay dưới mới là chỗ nói ra nó,
  // và nó đổi được sau khi form đã mở. Nhắc lại ở đây một câu có thể cũ đi
  // trong vòng một cú bấm thì thà không nói.
  if (noiVao.mocId) return 'Con của ' + tenNguoi(noiVao.mocId) + '.';

  if (noiVao.chaMeId) {
    return 'Con của ' + tenNguoi(noiVao.chaMeId) +
           ' — người này chưa có vợ/chồng nào trong gia phả, nên app sẽ tạo ' +
           'thêm một cặp mới cho riêng họ.';
  }

  return 'Con của ' + keTenPartner(noiVao.unionId) + '  ·  ' + noiVao.unionId;
}



function veCacO(nguoi) {
  const ra = [];
  const ten = mucTenChinh(nguoi);

  // Luật 13: CÂU HỎI "NỐI VÀO ĐÂU" LUÔN ĐỨNG ĐẦU FORM, ở cả ba chế độ thêm
  // quan hệ. Nó quyết định nghĩa của mọi ô đứng dưới — ô quan hệ đẻ/nuôi nói
  // về CẶP nào, ô thứ bậc đếm theo những cặp nào — nên hỏi sau là bắt người ta
  // trả lời mấy câu rồi mới biết chúng nói về cái gì.
  // Ô "đã có trong hệ thống chưa" (b124a) — ĐỨNG ĐẦU form ở ba chế độ mà chỗ
  // nối đã rõ từ nút vừa bấm; ở Thêm con nó đứng ngay sau "Cha mẹ là ai?" (luật
  // 13). Đổi 24/09/2026: trước đó nó nằm dưới cả khối hôn nhân, cách đầu hộp
  // Thêm vợ/chồng 619px — trên điện thoại chủ dự án tưởng là không có ô
  // (`../kiem-thu/kiem-o-da-co.mjs` đo vị trí).
  const coODaCo = CAN_KEO_NGUOI_XUYEN_CAY && laCheDoThem();
  if (coODaCo && N.cheDo !== 'themCon') ra.push(...khoiTimNguoiCoSan());

  if (N.cheDo === 'themCon') {
    ra.push(...khoiChonChaMe());
    if (coODaCo) ra.push(...khoiTimNguoiCoSan());
    ra.push(veNhan('Quan hệ với cặp này'));
    ra.push(oQuanHeMoi('Quan hệ của người con với cặp này', 'con'));
  }
  // Chỉ hỏi khi đang TẠO cặp cha mẹ mới. Nối thêm một người vào cặp đã có thì
  // quan hệ đẻ/nuôi của người con với cặp ấy đã ghi từ trước, và hỏi lại ở đây
  // là mời người dùng đổi một thứ họ không định đụng tới.
  if (N.cheDo === 'themChaMe' && !noiVao.unionId) {
    ra.push(veNhan('Quan hệ với ' + tenNguoi(noiVao.childId)));
    ra.push(oQuanHeMoi('Quan hệ của cha / mẹ này với ' + tenNguoi(noiVao.childId),
                       'chaMe'));
  }

  // Ba khối của hộp *Thêm vợ / chồng*, đúng thứ tự nhân quả: bảng con sẵn có
  // quyết CẶP NÀO, cặp nào quyết ô thứ bậc còn phải hỏi hay không, rồi mới tới
  // mấy ô của chính cuộc hôn nhân ấy. Ô thứ bậc nằm trong một hộp riêng để vẽ
  // lại được một mình nó khi bảng trên đổi (luật 12 + luật 13).
  if (N.cheDo === 'themBanDoi') {
    ra.push(...khoiConSanCo());
    khoiThuBac = document.createElement('div');
    veLaiThuBac();
    ra.push(khoiThuBac);
    ra.push(...khoiHonNhan());
  }

  // Ảnh chỉ hiện ở chế độ SỬA hồ sơ, cố ý. Ở các chế độ thêm người, bản ghi
  // chưa tồn tại nên chưa có mã để gắn ảnh vào, mà dựng đường gắn ảnh cho một
  // người chưa có mã là mở thêm một nhánh nữa trong một hàm lưu vốn đã nhiều
  // nhánh. Thêm người xong, mở lại hồ sơ rồi gắn ảnh — thêm đúng một cú chạm.
  if (N.cheDo === 'sua') {
    ra.push(veNhan('Ảnh'));
    ra.push(veKhoiAnh(nguoi.id, nguoi));
  }

  // Đánh dấu chỉ số ĐỂ BỌC LẠI phía dưới (b124a) — mọi phần tử từ đây tới hết
  // khối Ghi chú là "dữ liệu cá nhân", khoá lại khi đã chọn người có sẵn.
  const chiSoCaNhanBatDau = ra.length;

  ra.push(veNhan('Tên'));
  const hangTen = document.createElement('div');
  hangTen.style.cssText = 'display:flex;gap:6px';
  // Chữ mờ là TÊN CỦA Ô, không phải một cái tên ví dụ. Bản đầu gợi ý "Nguyễn ·
  // Trọng · Dũng" — tên một người có thật trong họ — và chủ dự án nêu ngay sau
  // lần thử đầu: chữ mờ ở ba ô liền nhau ghép lại thành một cái tên trọn vẹn
  // thì người dùng đọc ra "app đang mặc định là người này", chứ không đọc ra
  // "đây là ví dụ". Ô ngày thì khác — ở đó chữ mờ dạy CÁCH GÕ, nên giữ nguyên.
  hangTen.append(
    oChu('surname', 'Họ',  ten.surname, 'Họ',  1),
    oChu('middle',  'Đệm', ten.middle,  'Đệm', 1),
    oChu('given',   'Tên', ten.given,   'Tên', 1.2),
  );
  ra.push(hangTen);

  // TÊN PHỤ đứng NGAY DƯỚI tên chính, không xuống cuối form cùng bộ thông
  // dụng: nó là tên của cùng một người, và ai vừa gõ xong ba ô Họ · Đệm · Tên
  // thì tên huý đang ở ngay trong đầu họ.
  ra.push(veNhan('Tên khác'));
  ra.push(veKhoiTenPhu(nguoi));

  ra.push(veNhan('Giới tính'));
  // Thêm vợ/chồng: giới tính suy ra được từ người kia, nên điền sẵn và KHOÁ.
  // Thêm cha/mẹ: KHÔNG khoá — từ bước 27 chính ô này là chỗ nói đây là cha hay
  // là mẹ, nên khoá nó là bịt mất câu hỏi duy nhất của cả cái form.
  const khoaGioi = N.cheDo === 'themBanDoi' && !!(noiVao && noiVao.gioiNguoc);
  khoaGioiGoc = khoaGioi;   // b124a — "Bỏ chọn" trả giới tính về đúng trạng thái này
  gioiGoc     = nguoi.sex;
  ra.push(veChonGioi(nguoi.sex, khoaGioi));
  if (khoaGioi) ra.push(veDongGioi(noiVao.gioiMoc, noiVao.gioiNguoc, tenNguoi(noiVao.banDoiId)));

  ra.push(veNhan('Sinh'));
  ra.push(oNgay('birth', nguoi.birth));
  ra.push(oChu('birthPlace', 'Nơi sinh', khoiNgayCua(nguoi.birth).place, 'Làng Vân, Hà Nam'));

  ra.push(veNhan('Mất'));
  ra.push(oNgay('death', nguoi.death));
  ra.push(oChu('deathPlace', 'Nơi mất', khoiNgayCua(nguoi.death).place, ''));
  ra.push(oChu('burialPlace', 'Nơi an táng', nguoi.burialPlace, ''));
  // Ngày giỗ là ngày ÂM LỊCH và app KHÔNG suy ra nó từ ngày mất dương lịch —
  // xem `utils/text.ngayGio()`. Nên đây là ô CHỮ TỰ DO, chữ mờ dạy cách gõ.
  ra.push(oChu('gio', 'Ngày giỗ (âm lịch)',
               (nguoi.vn && nguoi.vn.gio) || '', '20 tháng Chạp'));
  ra.push(veConSong(nguoi.living === true));

  // --- BỘ THÔNG DỤNG của gia phả Việt (CAU-TRUC-DU-LIEU_V03) -------------
  //
  // ⚠ **Đặt SAU khối Mất, TRƯỚC Ghi chú — không xen vào giữa những khối cũ.**
  // Người đã quen form này tìm Tên · Giới tính · Sinh · Mất ở đúng chỗ cũ; tám
  // ô mới mọc thêm ở cuối thì không ai phải học lại thứ gì.
  //
  // ⚠ **Chữ mờ ở đây là VÍ DỤ, cố ý, và KHÔNG mâu thuẫn với luật bước 19.**
  // Luật ấy cấm chữ mờ ví dụ ở BA Ô TÊN liền nhau, vì ba ví dụ ghép lại thành
  // tên một người có thật và người dùng đọc ra "app đang mặc định người này".
  // Ô "Nghề nghiệp" thì không có cách nào ghép với ô bên cạnh thành một điều
  // khẳng định về ai cả — ở đây ví dụ dạy đúng thứ cần dạy: ô này chứa cái gì.
  //
  // ⚠ **KHÔNG có danh sách chọn cho Tôn giáo và Nghề nghiệp.** Gia phả cũ chép
  // bằng chữ của người chép — *"làm ruộng"*, *"thợ rèn"*, *"thờ cúng tổ tiên"*
  // — và ép vào danh sách là bắt người nhập chọn cái gần đúng rồi quên mất chữ
  // gốc. Cái giá: *"Phật giáo"* và *"đạo Phật"* máy không biết là một. Chấp
  // nhận, vì app này không thống kê theo tôn giáo.
  // Không có ô Đời (b160, chủ dự án): Đời do máy chủ tính theo dòng cha
  // (`tree_persons.doi`), số ghi tay `vn.generation` không còn tác dụng.
  ra.push(veNhan('Chi'));
  ra.push(oChu('chi', 'Chi / nhánh',
               (nguoi.vn && nguoi.vn.branch) || '', 'Chi Giáp'));

  ra.push(veNhan('Cuộc đời'));
  ra.push(oChu('title',      'Chức tước, phẩm hàm', nguoi.title,      'Cử nhân, Chánh tổng'));
  ra.push(oChu('occupation', 'Nghề nghiệp',         nguoi.occupation, 'Làm ruộng, dạy học'));
  ra.push(oChu('education',  'Học vấn',             nguoi.education,  'Tú tài'));
  ra.push(oChu('religion',   'Tôn giáo',            nguoi.religion,   'Thờ cúng tổ tiên'));
  // "khác nơi sinh" nằm ngay trong nhãn, không nằm ở một dòng chú thích riêng:
  // nơi sinh là MỘT ĐIỂM, nơi ở là chỗ sống phần đời — hai ô này gần giống nhau
  // đến mức không nói ra thì người dùng điền trùng, và bản xuất GEDCOM sau này
  // có `BIRT/PLAC` và `RESI` chép y hệt nhau.
  ra.push(oChu('residence',  'Quê quán / nơi ở (khác nơi sinh)', nguoi.residence,
               'Hà Nam — nơi sống lâu nhất'));
  ra.push(oChu('nationality', 'Dân tộc',            nguoi.nationality, 'Kinh'));
  // b150b — khách chỉ thấy khi cả cây lẫn chính chủ bật nhóm Liên hệ.
  ra.push(oChu('contact',    'Liên hệ',             nguoi.contact,    'Điện thoại, email, Zalo…'));

  // ⚠ Chữ mờ của ô này đã ĐỔI ngày 21/08/2026, và lý do đáng ghi lại: bản cũ
  // mời người dùng gõ *"Chức tước, quê quán"* vào đây — đúng hai thứ vừa có ô
  // riêng ngay phía trên. Để nguyên là dạy người ta chép chức tước vào ô ghì chú,
  // rồi bản xuất GEDCOM không có được một thẻ `TITL` nào.
  //
  // Không phép kiểm nào bắt được chỗ này — chữ mờ sai vẫn là một chuỗi hợp lệ.
  // Nó lộ ra khi CHỤP ẢNH cái form (`kiem-thu/xem-truong-moi.mjs`, tm-2.png).
  ra.push(veNhan('Ghi chú'));
  ra.push(oNhieuDong('note', nguoi.note,
                     'Chuyện gia đình cần nhớ, điều không có ô riêng…'));

  // b124a — bọc TOÀN BỘ khối Tên→Ghi chú vừa dựng vào một `<div>`, để
  // `capNhatKhoaCaNhan()` mờ + khoá cả cụm bằng một chỗ, không phải dò từng ô.
  // Đã chọn người có sẵn thì dữ liệu gõ ở đây KHÔNG được gửi đi — xem
  // `so-tay/luu-du-lieu.md`.
  if (laCheDoThem()) {
    const phanCaNhan = ra.splice(chiSoCaNhanBatDau);
    bocCaNhanKhoa = document.createElement('div');
    bocCaNhanKhoa.append(...phanCaNhan);
    ra.push(bocCaNhanKhoa);
    capNhatKhoaCaNhan();
  }

  // QUAN HỆ đứng CUỐI CÙNG, cùng lý lẽ đã dùng cho bộ thông dụng ở bước 32:
  // người đã quen form này tìm Tên · Giới tính · Sinh · Mất ở đúng chỗ cũ, còn
  // thứ mọc thêm ở cuối thì không ai phải học lại gì.
  //
  // Chỉ có ở chế độ SỬA, cùng lý do với khối ảnh: ở các chế độ thêm người, bản
  // ghi chưa có mã, mà quan hệ thì tra theo mã.
  if (N.cheDo === 'sua') ra.push(...veKhoiQuanHe(nguoi));

  return ra;
}

/**
 * Ô "đã có trong hệ thống chưa" — b124a. Gõ tên hoặc mã, chọn một dòng thì
 * `nguoiCoSanChon` được gán và khối Tên→Ghi chú khoá lại (`capNhatKhoaCaNhan`).
 * Không chọn gì thì mọi thứ chạy như trước — người MỚI, y hệt hôm qua.
 *
 * Dùng lại nguyên `ganGoiY()` của trang Quản trị (`quan-tri/o-goi-y.js`): ba
 * ô gõ tay mù ở đó và ô này cư xử giống hệt nhau — chờ ngừng gõ, hỏi máy chủ,
 * vẽ danh sách, đi bằng phím mũi tên. Chép lại là tự rước bốn cái bẫy file ấy
 * đã tính trước (đầu file `o-goi-y.js`).
 */
function khoiTimNguoiCoSan() {
  const boc = document.createElement('div');
  boc.style.cssText = 'margin-top:4px';

  const oNhap = document.createElement('input');
  oNhap.type = 'text';
  oNhap.placeholder = 'Bỏ trống nếu là người mới — gõ tên hoặc mã để tìm người đã có';
  oNhap.style.cssText = KIEU_O;
  oNhap.setAttribute('aria-label', 'Tìm người đã có trong hệ thống');

  const the = document.createElement('div');
  let dangNap = false;   // đang đọc hồ sơ người vừa chọn
  let loiNap  = '';      // câu lỗi của lần đọc ấy, rỗng = không có lỗi

  function veThe() {
    the.innerHTML = '';
    if (!nguoiCoSanChon) return;
    const hang = document.createElement('div');
    hang.style.cssText =
      'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;' +
      'padding:9px 11px;border:1px solid var(--sd-vang-vien,#cdbf98);border-radius:9px;' +
      'background:var(--sd-vang-nen,#fbf6e8);font-size:12px;line-height:1.5';

    const chu = document.createElement('span');
    chu.style.cssText = 'flex:1 1 200px;min-width:0';
    chu.textContent = '✓ Dùng người đã có: ' + nguoiCoSanChon.ten +
      ' (' + nguoiCoSanChon.id + ')' +
      (nguoiCoSanChon.cacCay ? ' — đã có ở: ' + nguoiCoSanChon.cacCay : '');

    const bo = document.createElement('button');
    bo.type = 'button';
    bo.textContent = 'Bỏ chọn, tự nhập người mới';
    bo.style.cssText =
      'margin-left:auto;padding:3px 9px;font-size:11px;white-space:nowrap;' +
      'border:1px solid var(--sd-vang-vien,#cdbf98);border-radius:6px;background:var(--sd-giay,#fffdf9);cursor:pointer';
    bo.addEventListener('click', () => {
      nguoiCoSanChon = null;
      loiNap = '';
      dangNap = false;
      oNhap.value = '';
      // ⚠ PHẢI XOÁ TRẮNG lại. Bỏ mấy ô đã điền nằm nguyên đấy thì cú bấm
      //   "tự nhập người mới" biến hồ sơ của người kia thành bản nháp của một
      //   người mới — và lần này nó ĐƯỢC GỬI ĐI, vì `nguoiCoSanChon` đã rỗng.
      dienTuNguoiCoSan(NGUOI_TRONG);
      veThe();
      capNhatKhoaCaNhan();
    });

    hang.append(chu, bo);
    the.append(hang);

    // Dòng thứ hai trả lời câu *"giờ tôi điền gì nữa"* — và phải nói ngay ở
    // đây, chứ không để người dùng tự đoán từ mấy ô xám bên dưới.
    const duoi = document.createElement('div');
    duoi.style.cssText =
      'margin-top:5px;font-size:11px;line-height:1.5;color:var(--sd-chu-vua,#6a625a)';
    duoi.textContent = dangNap
      ? 'Đang đọc hồ sơ của người này từ máy chủ…'
      : (loiNap
        ? '⚠ ' + loiNap + ' Vẫn nối được, chỉ là không xem trước được hồ sơ.'
        : 'Hồ sơ bên dưới lấy từ cơ sở dữ liệu và KHÔNG sửa ở đây được — ' +
          'một người chỉ có một bản ghi cho mọi gia phả. Muốn sửa thì thêm ' +
          'xong, mở hồ sơ người ấy ra sửa; sửa ở đâu cũng hiện ở mọi cây.');
    the.append(duoi);
  }

  // Hộp này CỐ Ý không tìm người đã thuộc cây đang mở (`tim_nguoi_moi_cay`).
  // Gõ đúng người ấy mà danh sách im lặng thì người dùng tưởng họ không tồn
  // tại (lời chủ dự án 24/09/2026, P0747 ở T388) — nên nói ra đường đúng.
  const nhac = document.createElement('div');
  nhac.style.cssText = 'margin-top:5px;font-size:12px;line-height:1.5;color:var(--sd-vang,#8a5a2b)';
  const nhacNguoiTrongCay = (chuoi) => {
    nhac.textContent = '';
    const kim = String(chuoi || '').trim();
    if (kim.length < 2 || !state.index) return;
    const thay = [...state.index.personById.values()].filter((p) =>
      p.id.toLowerCase() === kim.toLowerCase() || matchesSearch(fullName(p), kim)).slice(0, 3);
    if (thay.length === 0) return;
    nhac.textContent = thay.map((p) => fullName(p) + ' (' + p.id + ')').join(', ') +
      ' đã có trong gia phả này nên ô này không liệt kê. Muốn nối làm vợ/chồng, ' +
      'cha mẹ hay con: đóng form, bấm vào ô của người này trên sơ đồ → 🔗 Kết nối.';
  };

  ganGoiY(oNhap, {
    tim: async (chuoi) => {
      const kq = await timNguoiMoiCay(chuoi);
      const ds = kq.ok ? kq.ds : [];
      if (ds.length === 0) nhacNguoiTrongCay(chuoi); else nhac.textContent = '';
      return ds;
    },
    ve: dongNguoiCayKhac,
    giaTri: (m) => m.ten,
    khiChon: (m) => {
      nguoiCoSanChon = { id: m.maNguoi, ten: m.ten, cacCay: m.cacCay, gioi: m.gioi };
      veThe();
      capNhatKhoaCaNhan();
      napDayDu(m.maNguoi);
    },
  });

  /**
   * Đọc trọn bản ghi rồi ĐỔ VÀO các ô (b124a2).
   *
   * Không chờ được: một vòng mạng đứng giữa cú bấm và lời báo là chỗ người
   * dùng đọc ra *"bấm không ăn"*. Nên thẻ ✓ hiện ngay từ `khiChon`, còn hàm
   * này chạy sau và chỉ điền thêm.
   *
   * ⚠ Về muộn thì phải KIỂM LẠI xem người dùng còn đang chọn đúng người ấy
   *   không — họ có thể đã bấm *Bỏ chọn* hoặc chọn người khác trong lúc chờ.
   *   Không kiểm là điền dữ liệu của người này vào form đang nói về người kia.
   */
  async function napDayDu(ma) {
    dangNap = true;
    veThe();
    let kq;
    try {
      kq = await docNguoiTheoMa(ma);
    } catch (e) {
      kq = { ok: false, loi: e && e.message ? e.message : String(e) };
    }
    dangNap = false;
    if (!nguoiCoSanChon || nguoiCoSanChon.id !== ma) return;   // đã đổi ý

    if (!kq.ok || !kq.nguoi) {
      loiNap = kq.loi || 'Không đọc được hồ sơ của người này.';
      veThe();
      return;
    }
    loiNap = '';
    // Tên thật trong hồ sơ có thể khác chuỗi gợi ý (gợi ý ghép bằng
    // `ten_day_du()`), nên lấy lại từ chính bản ghi.
    nguoiCoSanChon.gioi = kq.nguoi.sex || nguoiCoSanChon.gioi;
    dienTuNguoiCoSan(kq.nguoi);
    veThe();
    capNhatKhoaCaNhan();
  }

  boc.append(oNhap, nhac, the);
  return [veNhan('Người này đã có trong hệ thống chưa?'), boc];
}

/**
 * Đổ hồ sơ đọc từ cơ sở dữ liệu vào đúng những ô của form (b124a2).
 *
 * ⚠ **Điền để NHÌN, không phải để gửi.** Ba nơi lưu đều đi qua
 *   `taoHoacDungNguoi()`: đã chọn người có sẵn thì chúng gửi MỖI quan hệ, còn
 *   bản ghi người thì không gửi một chữ nào (`so-tay/luu-du-lieu.md`). Nhờ
 *   thế điền vào đây là an toàn tuyệt đối — không có đường nào để mấy ô này
 *   ghi đè lên bản ghi của cây kia.
 *
 * ⚠ Vì sao phải điền, chứ không để khối trống mờ đi như b124a: chủ dự án nêu
 *   22/09/2026 — *"chọn người ở cây khác thì thông tin còn lại phải tự động
 *   điền từ cơ sở dữ liệu, không cho nhập tay"*. Khối trống không nói được
 *   câu quan trọng nhất: **bạn vừa chọn đúng người chưa.**
 */
function dienTuNguoiCoSan(nguoi) {
  const ten = mucTenChinh(nguoi);
  datO('surname', ten.surname);
  datO('middle',  ten.middle);
  datO('given',   ten.given);

  // Tên phụ đi qua mảng làm việc của form, không đi qua `o[...]` — đó là chỗ
  // duy nhất của form giữ riêng một bản sao, xem khối TÊN PHỤ.
  tenPhu = docTenPhu(nguoi);
  veLaiTenPhu();

  if (o.sex && typeof o.sex.datKhoa === 'function') o.sex.datKhoa(true, nguoi.sex || 'U');

  const sinh = khoiNgayCua(nguoi.birth);
  const mat  = khoiNgayCua(nguoi.death);
  datO('birth',      sinh.raw);
  datO('birthPlace', sinh.place);
  datO('death',      mat.raw);
  datO('deathPlace', mat.place);
  datO('burialPlace', nguoi.burialPlace);
  datO('gio', nguoi.vn && nguoi.vn.gio);
  datO('chi', nguoi.vn && nguoi.vn.branch);

  datO('title',       nguoi.title);
  datO('occupation',  nguoi.occupation);
  datO('education',   nguoi.education);
  datO('religion',    nguoi.religion);
  datO('residence',   nguoi.residence);
  datO('nationality', nguoi.nationality);
  datO('contact',     nguoi.contact);
  datO('note',        nguoi.note);

  if (o.living) o.living.checked = nguoi.living === true;
}

/**
 * Đặt giá trị cho một ô của form, và bắn `input` để mấy dòng chữ ăn theo ô ấy
 * tính lại — ô ngày có một dòng *"máy đọc được…"* chỉ cập nhật khi nghe sự
 * kiện này, nên gán thẳng `.value` là để lại một câu nói về chữ cũ.
 */
function datO(khoa, giaTri) {
  const el = o[khoa];
  if (!el || typeof el.value !== 'string') return;
  el.value = coGiaTri(giaTri) ? String(giaTri) : '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Mờ + khoá khối Tên→Ghi chú khi `nguoiCoSanChon` có giá trị; trả nó về đúng
 * trạng thái gốc khi bỏ chọn. Giới tính đi riêng qua `o.sex.datKhoa()` — API
 * chính hàm `veChonGioi()` đã bày sẵn — để hiện ĐÚNG giới tính thật của người
 * vừa chọn thay vì để trống, và để KHÔNG mở nhầm khoá "hôn nhân đồng giới" của
 * `themBanDoi` lúc bỏ chọn (khôi phục bằng `khoaGioiGoc`/`gioiGoc`, không phải
 * ép cứng về `false`).
 */
function capNhatKhoaCaNhan() {
  if (bocCaNhanKhoa) {
    const khoa = !!nguoiCoSanChon;
    // ⚠ b124a2 đổi `.4` thành `.88`, và đó là chuyện đọc được hay không.
    //   Khối này nay CÓ CHỮ — hồ sơ thật của người vừa chọn — và mờ 40% thì
    //   nó thành một mảng xám không ai đọc nổi, tức là mất đúng câu người
    //   dùng cần: *"mình vừa chọn đúng người chưa?"*
    bocCaNhanKhoa.style.opacity = khoa ? '.88' : '1';
    bocCaNhanKhoa.style.pointerEvents = khoa ? 'none' : 'auto';
    // `readOnly` chứ không `disabled`: `disabled` làm trình duyệt tô chữ xám
    // nhạt hơn nữa, và chính chữ ấy là thứ phải đọc được.
    for (const el of bocCaNhanKhoa.querySelectorAll('input, textarea, select')) {
      // `readOnly` không có ở `select` và ở ô tích, nên hai thứ ấy đi bằng
      // `disabled` — `pointer-events:none` đã chặn chuột, cái này chặn nốt
      // đường đi bằng phím Tab.
      if (el.tagName === 'SELECT' || el.type === 'checkbox') el.disabled = khoa;
      else el.readOnly = khoa;
      el.style.background = khoa ? 'var(--sd-nen-nhat,#f4efe6)' : 'var(--sd-giay,#fff)';
    }
  }
  if (o.sex && typeof o.sex.datKhoa === 'function') {
    o.sex.datKhoa(nguoiCoSanChon ? true : khoaGioiGoc,
                  nguoiCoSanChon ? (nguoiCoSanChon.gioi || null) : gioiGoc);
  }
}


// ============================================================
// Khối TÊN PHỤ — huý · tự · thụy · pháp danh · thường gọi
// ============================================================
//
// Thẻ thông tin ĐỌC RA những tên này từ bước 14 (`person.getAlternateNames`),
// còn form thì chưa bao giờ sửa được — treo lâu nhất trong bộ trường thông
// dụng, và là nửa B của việc 2 trong bảng giai đoạn 3.
//
// --- Vì sao MỘT ô chữ, không phải ba ô Họ · Đệm · Tên -------------------
//
// Schema cho tên phụ đúng cùng khuôn với tên chính (`surname`·`middle`·`given`),
// nhưng tên huý là *"Bá"*, pháp danh là *"Thích Minh Tâm"* — không ai tách
// chúng ra làm họ với đệm. Ba ô thì hai ô luôn trống, và ô trống trong form là
// một câu hỏi không ai trả lời được. Nên form hỏi MỘT ô, và ghi chữ ấy vào
// `given`; `fullName()` ghép lại đọc ra y nguyên.
//
// ⚠ **Chữ KHÔNG ĐỔI thì ba phần cũ được giữ nguyên** — xem `phanTenPhu()`.
// Ca thật sẽ đến ở việc 10 (nhập GEDCOM): file nước ngoài mang tên phụ đã tách
// sẵn `SURN`/`GIVN`, và mở form ra xem một lượt rồi bấm Lưu mà app dồn hết vào
// `given` là làm mất một phần dữ liệu người ta đã có.
//
// --- Vì sao form GIỮ RIÊNG một mảng, không đọc ngược từ DOM -------------
//
// Hàng thêm/bớt được thì DOM là thứ bị vẽ lại; đọc ngược từ nó là mỗi lần vẽ
// lại một lần phải khớp hàng cũ với hàng mới. Mảng `tenPhu` là bản làm việc,
// mọi ô ghi thẳng vào nó, và `gomThayDoi()` chỉ việc gửi cả mảng đi.

function veKhoiTenPhu(nguoi) {
  tenPhu = docTenPhu(nguoi);
  khoiTenPhu = document.createElement('div');
  veLaiTenPhu();
  return khoiTenPhu;
}

/** Tên phụ đang lưu, đọc thành bản làm việc của form. */
function docTenPhu(nguoi) {
  const ds = Array.isArray(nguoi.names) ? nguoi.names : [];
  // Cùng quy tắc chọn tên chính với `utils/text.fullName`: có 'chinh' thì lấy
  // nó, không có thì mục ĐẦU TIÊN. Chọn khác đi là form hiện tên chính của một
  // người trong danh sách tên phụ của chính họ.
  const chinh = ds.find((n) => n && n.type === 'chinh') || ds[0] || null;
  return ds
    .filter((n) => n && n !== chinh)
    .map((n) => ({
      type: coGiaTri(n.type) ? String(n.type) : 'khac',
      goc:  { surname: n.surname || '', middle: n.middle || '', given: n.given || '' },
      chu:  fullName(n),
    }));
}

function veLaiTenPhu() {
  if (!khoiTenPhu) return;
  khoiTenPhu.innerHTML = '';

  tenPhu.forEach((muc, i) => khoiTenPhu.append(veHangTenPhu(muc, i)));

  const them = document.createElement('button');
  them.type = 'button';
  them.textContent = '+ Thêm tên khác';
  them.setAttribute('aria-label', 'Thêm tên khác');
  them.style.cssText = KIEU_NUT_CHAN + 'width:100%;margin-top:6px;text-align:center;' +
    'background:var(--sd-nen,#faf8f5);color:var(--sd-chu,#2a2622);border:1px dashed var(--sd-vien,#ddd5ca)';
  them.addEventListener('click', () => {
    // Loại mặc định là TÊN HUÝ, không phải "Tên khác": gia phả Việt ghi tên huý
    // nhiều hơn hẳn bốn loại kia gộp lại, nên đoán như vậy đúng phần lớn số lần
    // — và đoán sai thì đổi mất một cú chạm.
    tenPhu.push({ type: 'huy', goc: { surname: '', middle: '', given: '' }, chu: '' });
    veLaiTenPhu();
    const oCuoi = khoiTenPhu.querySelector('input[data-ten-phu="' + (tenPhu.length - 1) + '"]');
    if (oCuoi) oCuoi.focus();
  });
  khoiTenPhu.append(them);
}

function veHangTenPhu(muc, i) {
  const hang = document.createElement('div');
  // ⚠ `flex-wrap` + `flex-basis:140px` ở ô chữ, KHÔNG dùng media query. Màn
  // hình hẹp (hộp form co xuống 280px) thì ba thứ trên một hàng không đủ chỗ,
  // và thứ bị bóp là ô chữ: ảnh `tp-2.png` cho thấy "Thích Minh Tâm" hiện ra
  // thành "Thích |". Ô chọn loại bị bóp thì còn bấm ra xem được; ô chữ bị bóp
  // là người ta gõ xong mà không đọc lại được thứ mình vừa gõ.
  //
  // Với `flex:1 1 140px`, hễ hàng còn dưới 140px cho ô chữ thì nó tự xuống
  // dòng — loại tên đứng một mình dòng trên, ô chữ và nút ✕ dòng dưới. Rộng
  // rãi thì cả ba nằm một hàng như cũ.
  //
  // ⚠ Khe GIỮA hai hàng (12px) phải rộng gấp đôi khe TRONG một hàng (6px).
  // Để cả hai bằng nhau thì lúc xuống dòng, ba hàng đọc lên thành sáu dòng
  // đều tăm tắp và không còn nhìn ra ô loại nào đi với ô chữ nào — ảnh
  // `tp-2.png` bản đầu là đúng cảnh ấy.
  hang.style.cssText =
    'display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;align-items:center';

  const chon = document.createElement('select');
  chon.setAttribute('aria-label', 'Loại tên khác ' + (i + 1));
  chon.style.cssText = KIEU_O + 'width:auto;flex:0 1 auto;min-width:0;padding-right:6px';
  const danhSach = LOAI_TEN_PHU.slice();
  // Mã lạ — dữ liệu cũ, hoặc file GEDCOM nhập từ phần mềm khác — được thêm vào
  // danh sách chứ không bị thay bằng một mã trong bảng. Không thêm thì cái
  // `<select>` tự nhảy về mục đầu tiên, và người dùng chỉ mở form ra xem cũng
  // đủ làm mất loại tên mà file gốc đã ghi rõ.
  if (!danhSach.some((x) => x.ma === muc.type)) {
    danhSach.push({ ma: muc.type, chu: nhanLoaiTenPhu(muc.type) });
  }
  for (const loai of danhSach) {
    const op = document.createElement('option');
    op.value = loai.ma;
    op.textContent = loai.chu;
    if (loai.ma === muc.type) op.selected = true;
    chon.append(op);
  }
  chon.addEventListener('change', () => { muc.type = chon.value; });

  const o1 = document.createElement('input');
  o1.type = 'text';
  o1.value = muc.chu;
  o1.placeholder = 'Bá';
  o1.setAttribute('aria-label', 'Tên khác ' + (i + 1));
  o1.setAttribute('data-ten-phu', String(i));
  o1.style.cssText = KIEU_O + 'flex:1 1 140px;min-width:0';
  o1.addEventListener('input', () => { muc.chu = o1.value; });

  const bo = document.createElement('button');
  bo.type = 'button';
  bo.textContent = '✕';
  bo.setAttribute('aria-label', 'Bỏ tên khác ' + (i + 1));
  bo.style.cssText =
    'flex:0 0 auto;width:38px;height:38px;font-size:15px;font-family:inherit;' +
    'border-radius:9px;cursor:pointer;touch-action:manipulation;' +
    'background:var(--sd-nen,#faf8f5);color:var(--sd-chu-phu,#8a8078);border:1px solid var(--sd-vien,#e6e0d8)';
  // Bỏ NGAY, không hỏi lại. Hàng này chưa được ghi xuống Drive — bỏ nhầm thì
  // bấm "+ Thêm tên khác" gõ lại, còn một hộp hỏi cho mỗi cú bấm là bắt người
  // ta trả lời một câu hỏi không đáng hỏi.
  bo.addEventListener('click', () => { tenPhu.splice(i, 1); veLaiTenPhu(); });

  hang.append(chon, o1, bo);
  return hang;
}

/**
 * Một hàng trong form thành một mục `names[]`.
 *
 * Chữ không đổi so với lúc mở form thì trả lại ĐÚNG ba phần cũ — xem ghi chú
 * đầu khối. Chữ đã đổi thì cả câu vào `given`, hai phần kia trống: người vừa
 * gõ lại tên ấy đang gõ một cái tên liền, không gõ một cấu trúc ba phần.
 */
function phanTenPhu(muc) {
  const chu = String(muc.chu || '').trim();
  if (chu === fullName(muc.goc)) {
    return Object.assign({ type: muc.type }, muc.goc);
  }
  return { type: muc.type, surname: '', middle: '', given: chu };
}

// ============================================================
// Khối QUAN HỆ — việc 3 (21/08/2026)
// ============================================================
//
// Ba nhóm, đúng ba câu chủ dự án hỏi: quan hệ với CHA MẸ · trạng thái và thứ
// bậc của từng cặp VỢ CHỒNG · quan hệ với từng người CON.
//
// --- Vì sao nhóm nào rỗng thì bỏ hẳn nhóm ấy ---------------------------
//
// Trái với luật "form HIỆN ĐỦ MỌI Ô" ở đầu file, và có chủ ý. Luật ấy nói về ô
// trống — một câu hỏi chưa ai trả lời. Ở đây khác: người chưa nối với cha mẹ
// nào thì KHÔNG CÓ câu hỏi nào để hỏi, và vẽ ra một nhóm rỗng là mời người
// dùng đi tìm cái nút thêm cha mẹ ở một khối vốn không có nút nào như thế.
// Cả ba nhóm cùng rỗng thì bỏ luôn cả khối.
//
// --- Vì sao giữ riêng một bản làm việc, không đọc ngược từ DOM ----------
//
// Cùng lý lẽ với `tenPhu` ở bước 33, cộng một lý do riêng: các ô ở đây tra
// theo `unionId` và `personId`, mà DOM chỉ giữ được chỉ số hàng. Đọc ngược
// là mỗi lần đọc một lần phải dựng lại phép khớp hàng → mã người, và đó đúng
// là chỗ để lọt một cú ghi nhầm sang người bên cạnh.
//
// ⚠ `cu` giữ nguyên giá trị lúc MỞ form. Mọi so sánh "có đổi gì không" đều so
// với `cu`, không so với cây — đúng tinh thần ghi chú của `handleSaveUnion`:
// mở form rồi bấm Lưu ngay phải là một việc KHÔNG để lại dấu vết.

function veKhoiQuanHe(nguoi) {
  const index = state.index;
  if (!index || !index.personById.has(nguoi.id)) return [];

  quanHe = docQuanHe(index, nguoi.id);
  if (quanHe.chaMe.length === 0 && quanHe.banDoi.length === 0 &&
      quanHe.con.length === 0) {
    quanHe = null;
    return [];
  }

  const ra = [veNhan('Quan hệ')];

  const nhac = document.createElement('div');
  nhac.textContent =
    'Ở đây chỉ SỬA những quan hệ đã có. Thêm hoặc gỡ một người nằm ở vòng ' +
    'tròn — mục Kết nối và Gỡ nối.';
  nhac.style.cssText = 'font-size:11px;line-height:1.45;color:var(--sd-chu-phu,#8a8078);margin-top:2px';
  ra.push(nhac);

  if (quanHe.chaMe.length > 0) {
    ra.push(veNhanNhom('Cha mẹ'));
    quanHe.chaMe.forEach((m, i) => ra.push(veHangChaMe(m, i)));
  }

  if (quanHe.banDoi.length > 0) {
    ra.push(veNhanNhom('Vợ / chồng'));
    quanHe.banDoi.forEach((m, i) => ra.push(veHangBanDoi(m, i)));
    const nhacBac = document.createElement('div');
    nhacBac.textContent =
      'Ô số là THỨ BẬC: 1 là vợ cả / chồng đầu, 2 là vợ thứ hai… Không phải ' +
      'chỗ đứng trái phải trên sơ đồ.';
    nhacBac.style.cssText =
      'font-size:11px;line-height:1.45;color:var(--sd-chu-phu,#8a8078);margin-top:4px';
    ra.push(nhacBac);
  }

  if (quanHe.con.length > 0) {
    ra.push(veNhanNhom('Con'));
    quanHe.con.forEach((m, i) => ra.push(veHangCon(m, i)));
  }

  return ra;
}

/**
 * Bản làm việc của khối, đọc từ chỉ mục.
 *
 * ⚠ ĐÂY KHÔNG PHẢI MỘT PHÉP DUYỆT ĐỒ THỊ, nên không cần tập `visited`: nó đi
 * đúng MỘT bước từ người đang sửa — sang các cặp cha mẹ, các cặp của chính họ,
 * các người con — rồi DỪNG, không đi tiếp từ những người tìm được. Ai sửa hàm
 * này mà cho nó đi sâu thêm một bậc (ví dụ "sửa luôn quan hệ của các cháu")
 * thì phải thêm `visited` — gia phả là đồ thị có vòng, và bản dữ liệu làm việc
 * đang có sẵn hai vòng.
 *
 * ⚠ Đọc qua bốn hàm `get*` của `domains/union.js` chứ không tự duyệt
 * `u.partners`: bốn hàm ấy lọc người mang cờ `deleted` ra, còn mã họ thì vẫn
 * nằm nguyên trong `partners`/`children` (xoá mềm cố ý không dọn hai mảng
 * ấy). Tự duyệt là bày ra một ô chọn cho một người đã nằm trong thùng rác.
 */
function docQuanHe(index, personId) {
  const ra = { mocId: personId, chaMe: [], banDoi: [], con: [] };

  for (const u of getParentUnions(index, personId)) {
    const muc = (Array.isArray(u.children) ? u.children : [])
      .find((c) => c && c.personId === personId);
    const cu = (muc && muc.relation) || 'birth';
    // Rào thép (b128a): cặp cha mẹ có một đầu ngoài cây thì KHOÁ — không sửa
    // được ở đây, chỉ còn đường gửi đề nghị (b127d-2, nút ✉).
    ra.chaMe.push({ unionId: u.id, ten: keTenPartner(u.id), cu, moi: cu,
                     ngoai: capCoNguoiNgoaiCay(u) });
  }

  // Union PARTNER dùng chung cho cả nhóm Vợ/chồng lẫn nhóm Con: một cặp có
  // đầu ngoài cây thì khoá cả hai, và tính `capCoNguoiNgoaiCay` một lần rồi
  // tra theo mã cặp — không tính lại cho từng con.
  const dsCapBanDoi = getPartnerUnions(index, personId);
  const ngoaiTheoCap = new Map(dsCapBanDoi.map((u) => [u.id, capCoNguoiNgoaiCay(u)]));

  for (const u of dsCapBanDoi) {
    // `maTrangThaiCap` giữ đúng phép chuẩn hoá của `handleSaveUnion`: thiếu
    // `status` thì coi là 'married', nhưng một mã khác hai mã quen thì GIỮ
    // NGUYÊN chứ không ép về 'married' — cùng lối với mã loại tên lạ ở bước 33.
    const ttCu = maTrangThaiCap(u);
    ra.banDoi.push({
      unionId: u.id,
      ten:     tenBanDoiTrongCap(index, u, personId),
      ttCu, ttMoi: ttCu,
      bacCu:  rankCua(u, personId),
      bacMoi: String(rankCua(u, personId)),
      ngoai:  ngoaiTheoCap.get(u.id) || null,
    });
  }

  for (const m of getChildren(index, personId)) {
    ra.con.push({
      unionId:  m.unionId,
      personId: m.personId,
      ten:      tenNguoi(m.personId),
      cu:       m.relation,
      moi:      m.relation,
      ngoai:    ngoaiTheoCap.get(m.unionId) || null,
    });
  }

  return ra;
}


/**
 * Nhãn của một NHÓM trong khối Quan hệ — Cha mẹ · Vợ/chồng · Con.
 *
 * Không mượn `veNhanO`: nhãn ấy là nhãn của MỘT Ô (11px, xám rất nhạt, sát
 * ngay trên ô của nó). Ba chữ này là đầu đề của cả một nhóm, và ở bản đầu mượn
 * `veNhanO` thì ảnh `qh-0.png` cho thấy chúng chìm nghỉm giữa các hàng — mắt
 * không tìm ra đâu là chỗ nhóm Vợ/chồng bắt đầu.
 */
function veNhanNhom(chu) {
  const d = document.createElement('div');
  d.textContent = chu;
  d.style.cssText =
    'margin-top:16px;margin-bottom:2px;font-size:11px;font-weight:600;' +
    'letter-spacing:.04em;color:var(--sd-chu-phu,#8a8078)';
  return d;
}

/**
 * Một mục trong khối Quan hệ: TÊN một dòng, các ô một dòng dưới.
 *
 * ⚠ HAI DÒNG CỐ ĐỊNH, không phải một hàng ngang biết tự xuống dòng. Bản đầu
 * xếp tên và ô trên cùng một hàng `flex-wrap` — cùng lối với hàng tên phụ —
 * và ảnh `qh-0.png` cho thấy vì sao lối ấy không dùng lại được ở đây:
 *
 *   · tên người Việt đủ ba phần dài hơn hẳn một cái tên huý, nên hàng gãy ngay
 *     ở khổ 360px chứ không đợi tới 280px — tức là nó gãy LÚC NÀO là tuỳ vào
 *     tên ai đang đứng đó, và hai mục cạnh nhau trông không giống nhau;
 *   · hàng Vợ/chồng có BA thứ, nên khi gãy thì ô số thứ bậc rơi xuống một dòng
 *     riêng, đứng lơ lửng một mình bên trái, không còn nói lên nó là thứ bậc
 *     của cặp nào.
 *
 * Hai dòng cố định thì mọi mục trông như nhau ở mọi khổ, và hai ô của một cặp
 * luôn dính nhau.
 */
function veMucQuanHe(ten, cacO) {
  const boc = document.createElement('div');
  boc.style.cssText = 'margin-top:12px';

  const d = document.createElement('div');
  d.textContent = ten;
  d.style.cssText =
    'font-size:13px;line-height:1.4;color:var(--sd-chu,#2a2622);margin-bottom:4px;' +
    'overflow-wrap:anywhere';

  const hang = document.createElement('div');
  hang.style.cssText = 'display:flex;gap:6px;align-items:center';
  hang.append(...cacO);

  boc.append(d, hang);
  return boc;
}

/**
 * Ô chọn quan hệ đẻ/nuôi.
 *
 * ⚠ Mã lạ — dữ liệu cũ, hoặc file GEDCOM nhập từ phần mềm khác — được THÊM vào
 * danh sách chứ không bị thay bằng một mã trong bảng. Đúng bài học của bước 33:
 * không thêm thì `<select>` tự nhảy về mục đầu tiên, và người dùng chỉ mở form
 * ra xem cũng đủ biến một quan hệ lạ thành 'birth' — mà 'birth' là quan hệ BẬT
 * lại bốn phép rà tuổi sinh học.
 */
function oChonQuanHe(nhan, maCu, phia, khiDoi) {
  const chon = document.createElement('select');
  chon.setAttribute('aria-label', nhan);
  chon.style.cssText = KIEU_O + 'width:auto;flex:1 1 auto;min-width:0;padding-right:6px';

  const ds = QUAN_HE_CON_NHAN.slice();
  if (!ds.some((x) => x.ma === maCu)) ds.push({ ma: maCu, con: maCu, chaMe: maCu });

  for (const q of ds) {
    const op = document.createElement('option');
    op.value = q.ma;
    op.textContent = nhanQuanHeCon(q.ma, phia);
    if (q.ma === maCu) op.selected = true;
    chon.append(op);
  }
  chon.addEventListener('change', () => khiDoi(chon.value));
  return chon;
}

function veHangChaMe(m, i) {
  const chon = oChonQuanHe('Quan hệ với cha mẹ ' + (i + 1), m.cu, 'chaMe',
                            (ma) => { m.moi = ma; });
  if (!m.ngoai) return veMucQuanHe(m.ten, [chon]);

  // Rào thép: cặp cha mẹ có một đầu ngoài cây — không sửa được ở đây (luật 11),
  // gỡ chính mocId khỏi con của cặp này là đúng thứ hàng này đang hỏi.
  chon.disabled = true;
  const { nut, ghiChu } = veKhoaNgoaiCay('go_con', m.unionId, quanHe.mocId, m.ngoai);
  const muc = veMucQuanHe(m.ten, [chon, nut]);
  muc.append(ghiChu);
  return muc;
}

function veHangCon(m, i) {
  const chon = oChonQuanHe('Quan hệ với con ' + (i + 1), m.cu, 'con', (ma) => { m.moi = ma; });
  if (!m.ngoai) return veMucQuanHe(m.ten, [chon]);

  // Cặp cha/mẹ của con này có một đầu ngoài cây — gỡ đúng người con của hàng
  // này khỏi cặp ấy, không đụng tới các con khác của cùng cặp.
  chon.disabled = true;
  const { nut, ghiChu } = veKhoaNgoaiCay('go_con', m.unionId, m.personId, m.ngoai);
  const muc = veMucQuanHe(m.ten, [chon, nut]);
  muc.append(ghiChu);
  return muc;
}

function veHangBanDoi(m, i) {
  const chon = document.createElement('select');
  chon.setAttribute('aria-label', 'Cặp ' + (i + 1) + ' bây giờ');
  chon.style.cssText = KIEU_O + 'width:auto;flex:1 1 auto;min-width:0;padding-right:6px';

  const CAC = TRANG_THAI_CAP.slice();
  if (!CAC.some((x) => x.ma === m.ttCu)) CAC.push({ ma: m.ttCu, chu: m.ttCu });

  for (const c of CAC) {
    const op = document.createElement('option');
    op.value = c.ma;
    op.textContent = c.chu;
    if (c.ma === m.ttCu) op.selected = true;
    chon.append(op);
  }
  chon.addEventListener('change', () => { m.ttMoi = chon.value; });

  const bac = document.createElement('input');
  bac.type = 'text';
  bac.inputMode = 'numeric';
  bac.value = m.bacMoi;
  // Nhãn nêu TÊN NGƯỜI LÀM MỐC, không phải số thứ tự của hàng: hàng này đứng
  // cạnh tên người BẠN ĐỜI, nên "Thứ bậc của cặp 2" trống không thì đọc lên
  // dễ thành thứ bậc của người bạn đời ấy — đúng nửa sai mà `DAC-TA-RANK`
  // mục 1 mô tả. Mốc luôn là người đang mở màn hình này (`quanHe.mocId`),
  // cùng một câu chữ với form Sửa cặp (`oThuBac`).
  bac.setAttribute('aria-label',
    'Đây là cặp thứ mấy của ' + tenNguoi(quanHe ? quanHe.mocId : '') + '?');
  bac.style.cssText = KIEU_O + 'flex:0 0 56px;width:56px;min-width:0;text-align:center';
  bac.addEventListener('input', () => { m.bacMoi = bac.value; });

  if (!m.ngoai) return veMucQuanHe(m.ten, [chon, bac]);

  // Rào thép: gỡ NGƯỜI NGOÀI CÂY khỏi hôn nhân, không gỡ mocId — mocId có thể
  // đang là cha/mẹ của các con chung trong cùng cặp này, gỡ mocId sẽ làm mất
  // luôn quan hệ cha/mẹ ấy mà hàng này không hề nói tới.
  chon.disabled = true;
  bac.disabled = true;
  const { nut, ghiChu } = veKhoaNgoaiCay('go_vo_chong', m.unionId, m.ngoai.id, m.ngoai);
  const muc = veMucQuanHe(m.ten, [chon, bac, nut]);
  muc.append(ghiChu);
  return muc;
}

/**
 * Nút ✉ + dòng ghi chú cho một hàng của khối Quan hệ bị KHOÁ vì cặp có người
 * ngoài cây (rào thép b128a, `so-tay/nguoi-xuyen-cay.md`). Khối này chỉ SỬA
 * quan hệ đã có (luật 11, sổ tay) nên không có đường gỡ nào khác — bấm nút mở
 * một ô nhỏ để gõ lý do và gửi `repo.nopDeNghiQuanHe()` (b127d-2, `luoc-do/33`).
 * Quản trị hệ thống duyệt thì máy chủ TỰ GỠ; ở đây chỉ nộp đơn.
 *
 * @param {'go_con'|'go_vo_chong'} loai
 * @param {string} unionId
 * @param {string} personId  người sẽ bị gỡ khỏi cặp nếu đề nghị được duyệt
 * @param {{id:string, p:object}} ngoai  người ngoài cây làm hàng này bị khoá
 * @returns {{nut:HTMLElement, ghiChu:HTMLElement}}
 */
function veKhoaNgoaiCay(loai, unionId, personId, ngoai) {
  const tenNgoai = (ngoai && ngoai.p && fullName(ngoai.p)) || (ngoai && ngoai.id) || '';

  const ghiChu = document.createElement('div');
  ghiChu.textContent =
    tenNgoai + ' không thuộc gia phả này nên không sửa được ở đây. Sai thì gửi ' +
    'đề nghị để Quản trị hệ thống gỡ.';
  ghiChu.style.cssText = 'font-size:11px;line-height:1.4;color:var(--sd-chu-phu,#8a8078);margin-top:2px';

  const nut = document.createElement('button');
  nut.type = 'button';
  nut.textContent = '✉ Đề nghị sửa';
  nut.setAttribute('aria-label', 'Đề nghị gỡ quan hệ với ' + tenNgoai);
  nut.style.cssText =
    'flex:0 0 auto;min-height:36px;padding:0 10px;font-size:12px;font-family:inherit;' +
    'border-radius:8px;cursor:pointer;touch-action:manipulation;' +
    'background:var(--sd-nen,#faf8f5);color:var(--sd-chu-vua,#5c554e);border:1px solid var(--sd-vien,#e6e0d8)';

  let boc = null;   // ô gõ lý do, dựng lúc bấm — mỗi lúc chỉ một cái mở
  nut.addEventListener('click', () => {
    if (boc) { boc.remove(); boc = null; return; }
    boc = veHopGuiDeNghi(loai, unionId, personId, tenNgoai, () => {
      boc = null;
      nut.disabled = true;
      nut.textContent = '✉ Đã gửi — chờ duyệt';
    });
    ghiChu.after(boc);
  });

  return { nut, ghiChu };
}

/** Ô nhỏ: một lý do + nút Gửi/Thôi, gọi thẳng `repo.nopDeNghiQuanHe()`. */
function veHopGuiDeNghi(loai, unionId, personId, tenNgoai, khiXong) {
  const boc = document.createElement('div');
  boc.style.cssText =
    'margin-top:6px;padding:8px;border-radius:8px;background:var(--sd-nen,#faf8f5);' +
    'border:1px solid var(--sd-vien,#e6e0d8)';

  const nhan = document.createElement('div');
  nhan.textContent = 'Vì sao quan hệ với ' + tenNgoai + ' cần gỡ?';
  nhan.style.cssText = 'font-size:12px;color:var(--sd-chu-vua,#5c554e);margin-bottom:4px';

  const oLyDo = document.createElement('textarea');
  oLyDo.rows = 2;
  oLyDo.maxLength = 1000;
  oLyDo.placeholder = 'Bắt buộc — Quản trị hệ thống đọc câu này để quyết định.';
  oLyDo.style.cssText = KIEU_O + 'font-family:inherit;resize:vertical';

  const loi = document.createElement('div');
  loi.style.cssText =
    'margin-top:6px;padding:7px 9px;font-size:12px;line-height:1.4;border-radius:7px;' +
    'color:var(--sd-do,#8a3a2a);background:var(--sd-do-nen,#fbf0ec);border:1px solid var(--sd-do-vien,#f0d8d0)';
  loi.hidden = true;

  const bGui = document.createElement('button');
  bGui.type = 'button';
  bGui.textContent = 'Gửi đề nghị';
  bGui.style.cssText = KIEU_NUT_CHAN +
    'flex:1 1 auto;background:var(--sd-vang-dac,#8a6a3a);color:var(--sd-nut-chu,#fffdf9);border:1px solid var(--sd-vang,#8a6a3a);font-weight:600';

  const bHuy = document.createElement('button');
  bHuy.type = 'button';
  bHuy.textContent = 'Thôi';
  bHuy.style.cssText = KIEU_NUT_CHAN +
    'flex:0 0 auto;background:var(--sd-giay,#fffdf9);color:var(--sd-chu,#2a2622);border:1px solid var(--sd-vien,#e6e0d8)';
  bHuy.addEventListener('click', () => boc.remove());

  const hang = document.createElement('div');
  hang.style.cssText = 'display:flex;gap:6px;margin-top:6px';
  hang.append(bGui, bHuy);

  bGui.addEventListener('click', async () => {
    const lyDo = oLyDo.value.trim();
    if (!lyDo) {
      loi.textContent = 'Cần ghi lý do trước khi gửi.';
      loi.hidden = false;
      return;
    }
    bGui.disabled = true; bHuy.disabled = true; oLyDo.disabled = true;
    bGui.textContent = 'Đang gửi…';
    loi.hidden = true;

    let kq;
    try { kq = await nopDeNghiQuanHe(loai, unionId, personId, lyDo); }
    catch (e) { kq = { ok: false, loi: (e && e.message) || 'Lỗi không rõ.' }; }

    if (!kq || kq.ok === false) {
      bGui.disabled = false; bHuy.disabled = false; oLyDo.disabled = false;
      bGui.textContent = 'Gửi đề nghị';
      loi.textContent = (kq && (kq.loi || kq.lyDo)) || 'Máy chủ từ chối.';
      loi.hidden = false;
      return;
    }

    if (typeof khiXong === 'function') khiXong();
    boc.remove();
  });

  boc.append(nhan, oLyDo, loi, hang);
  return boc;
}

/**
 * Áp mọi thay đổi quan hệ lên cây, NỐI ĐUÔI nhau.
 *
 * @param {object} cay  cây mà `updatePerson` (và phép áp ảnh) vừa trả về
 * @returns {{tree:object, diff:object, capDoi:object[]}}
 *
 * ⚠ NỐI ĐUÔI là bắt buộc, không phải cho gọn: mỗi hàm trả về một CÂY MỚI, nên
 * chạy hai hàm trên cùng một cây cũ là cây gửi lên chỉ mang một trong hai thay
 * đổi. Cùng cái bẫy mà `handleSaveUnion` đã gặp với `swapPartnerOrder`.
 *
 * ⚠ Một cặp có thể bị đụng HAI LẦN (đổi quan hệ một người con, rồi đổi luôn
 * trạng thái của chính cặp ấy). Gom theo mã cặp, bản sau đè bản trước — mà bản
 * sau chạy trên cây đã mang thay đổi trước, nên nó là bản ĐỦ CẢ HAI.
 */
function apThayDoiQuanHe(cay) {
  const ra = { tree: cay, diff: {}, capDoi: [] };
  if (!quanHe) return ra;

  const theoMa = new Map();
  const nhan = (kq) => {
    if (!kq || !kq.thayDoi) return;
    ra.tree = kq.tree;
    Object.assign(ra.diff, kq.diff);
    theoMa.set(kq.union.id, kq.union);
  };

  for (const m of quanHe.chaMe) {
    if (m.moi === m.cu) continue;
    nhan(updateChildRelation(ra.tree, m.unionId, quanHe.mocId, m.moi));
  }

  for (const m of quanHe.con) {
    if (m.moi === m.cu) continue;
    nhan(updateChildRelation(ra.tree, m.unionId, m.personId, m.moi));
  }

  for (const m of quanHe.banDoi) {
    // Chỉ gửi thứ THẬT SỰ khác bản đang lưu — đúng ghi chú của
    // `handleSaveUnion`: `updateUnion` so với giá trị đã chuẩn hoá, nên cặp
    // chưa có `status` mà gửi 'married' xuống là một dòng changeLog cho một
    // việc chẳng ai làm.
    const changes = {};
    if (m.ttMoi !== m.ttCu) changes.status = m.ttMoi;

    const n = Number(String(m.bacMoi).trim());
    if (Number.isFinite(n) && n > 0 && n !== m.bacCu) changes.ranks = { [quanHe.mocId]: n };

    if (Object.keys(changes).length === 0) continue;
    nhan(updateUnion(ra.tree, m.unionId, changes));
  }

  ra.capDoi = [...theoMa.values()];
  return ra;
}

/** Một câu kể những gì khối Quan hệ vừa đổi, để đưa vào `changeLog`. */
function keThayDoiQuanHe(qh) {
  if (!qh || qh.capDoi.length === 0) return '';
  const n = qh.capDoi.length;
  return ' Sửa quan hệ ở ' + n + ' cặp.';
}






/**
 * Ba nút giới tính. `biKhoa` = bày ra nhưng không bấm được.
 *
 * Khoá dùng ở đúng MỘT chỗ: thêm vợ/chồng cho người đã biết giới tính. Lúc ấy
 * giới tính của người mới **suy ra được** — và một ô mà app đã biết câu trả lời
 * thì để mở là mời gõ vào một mâu thuẫn. Nhưng khoá cứng thì hôn nhân đồng giới
 * hết đường ghi, nên bên cạnh luôn có công tắc mở khoá (`veDongGioi`).
 *
 * ⚠ Khoá là **bày ra rồi làm mờ**, KHÔNG phải giấu đi. Giấu thì người dùng
 * không biết app đã tự quyết một trường của bản ghi họ sắp lưu.
 */
function veChonGioi(sexHienTai, biKhoa) {
  const hang = document.createElement('div');
  hang.style.cssText = 'display:flex;gap:6px';

  let dangChon = GIOI.some((g) => g.ma === sexHienTai) ? sexHienTai : 'U';
  let khoa = !!biKhoa;
  const cacNut = [];

  const veLai = () => {
    for (const { ma, nut } of cacNut) {
      const chon = ma === dangChon;
      nut.disabled = khoa;
      nut.style.cssText = KIEU_NUT_CHON +
        (khoa ? 'cursor:not-allowed;opacity:.5;' : '') +
        (chon
          ? 'background:var(--sd-nut,#2a2622);color:var(--sd-nut-chu,#fffdf9);border:1px solid var(--sd-nut,#2a2622);font-weight:600'
          : 'background:var(--sd-nen,#faf8f5);color:var(--sd-chu,#2a2622);border:1px solid var(--sd-vien,#e6e0d8)');
    }
  };

  for (const g of GIOI) {
    const nut = document.createElement('button');
    nut.type = 'button';
    nut.textContent = g.chu;
    nut.addEventListener('click', () => { if (!khoa) { dangChon = g.ma; veLai(); } });
    cacNut.push({ ma: g.ma, nut });
    hang.append(nut);
  }
  veLai();

  // Đọc bằng hàm chứ không bằng `.value`: giới tính ở đây là ba cái nút, không
  // phải một ô nhập, nên `docO()` không lấy được. Giữ chung một lối đọc cho cả
  // form thì `gomThayDoi()` không phải biết ô nào là loại gì.
  o.sex = {
    value: '',
    doc: () => dangChon,
    datKhoa: (dong, ma) => { khoa = !!dong; if (ma) dangChon = ma; veLai(); },
  };
  return hang;
}

/**
 * Công tắc HÔN NHÂN ĐỒNG GIỚI. Chỉ có ở chế độ thêm vợ/chồng, và chỉ khi biết
 * giới tính của người kia.
 *
 * Không phải một trường dữ liệu — gia phả **không lưu** cờ "đồng giới" ở đâu
 * cả. Nó chỉ mở khoá ba cái nút giới tính, vì `partners` vốn là MẢNG hai chiều
 * bình đẳng và hôn nhân đồng giới ghi được từ đầu (HIEN-PHAP mục dữ liệu). Cái
 * duy nhất cần bỏ là **giả định mặc định**, và giả định thì bỏ bằng một cú chạm.
 *
 * Tích vào thì giới tính nhảy sang **cùng giới** với người kia — đó là ý của
 * chữ "đồng giới", và người dùng vẫn đổi lại được. Bỏ tích thì khoá lại và trả
 * về giới tính ngược.
 */
function veDongGioi(gioiMoc, gioiNguoc, tenMoc) {
  const nhan = document.createElement('label');
  nhan.style.cssText =
    'display:flex;align-items:center;gap:9px;margin-top:6px;padding:9px 11px;' +
    'border:1px solid var(--sd-vien,#e6e0d8);border-radius:9px;background:var(--sd-nen,#faf8f5);' +
    'font-size:14px;cursor:pointer;touch-action:manipulation';

  const hop = document.createElement('input');
  hop.type = 'checkbox';
  hop.checked = false;
  hop.style.cssText = 'width:18px;height:18px;accent-color:var(--sd-chu,#2a2622)';
  hop.addEventListener('change', () => {
    if (o.sex && typeof o.sex.datKhoa === 'function') {
      o.sex.datKhoa(!hop.checked, hop.checked ? gioiMoc : gioiNguoc);
    }
  });
  o.dongGioi = hop;

  const chu = document.createElement('span');
  chu.textContent = 'Hôn nhân đồng giới — cùng giới với ' + tenMoc;

  nhan.append(hop, chu);
  return nhan;
}

function veConSong(dangSong) {
  const nhan = document.createElement('label');
  nhan.style.cssText =
    'display:flex;align-items:center;gap:9px;margin-top:10px;padding:9px 11px;' +
    'border:1px solid var(--sd-vien,#e6e0d8);border-radius:9px;background:var(--sd-nen,#faf8f5);' +
    'font-size:14px;cursor:pointer;touch-action:manipulation';

  const hop = document.createElement('input');
  hop.type = 'checkbox';
  hop.checked = dangSong === true;
  hop.style.cssText = 'width:18px;height:18px;accent-color:var(--sd-chu,#2a2622)';
  o.living = hop;

  const chu = document.createElement('span');
  chu.textContent = 'Người này còn sống';

  nhan.append(hop, chu);
  return nhan;
}

/**
 * Ô chọn quan hệ đẻ/nuôi cho một mối nối SẮP TẠO RA — đủ **năm** mã.
 *
 * Không phải chuyện hình thức: `validate.js` bỏ qua MỌI phép rà tuổi sinh học
 * khi thấy quan hệ khác `'birth'` (cha mẹ nuôi trẻ hơn con nuôi là hợp lệ).
 * Chọn sai ở đây là tắt mất bốn phép rà, hoặc bật nhầm bốn phép rà lên một
 * quan hệ không mang ràng buộc nào.
 *
 * ⚠ **Trước bước 65 đây là một Ô TÍCH, và ô tích chỉ ghi được `adopted`** —
 * hạn chế đã ghi trong `KE-HOACH` từ việc 8: muốn ghi *mẹ kế* (`step`) thì
 * phải thêm người xong rồi vào form hồ sơ đổi lại. Nay ba cửa cùng dùng đúng
 * `oChonQuanHe()` mà khối Quan hệ (việc 3) vẫn dùng, nên năm mã ghi được ngay
 * lúc nhập, và không có bản logic thứ hai nào để trôi lệch.
 *
 * @param {string} nhan  chữ cho trình đọc màn hình — ô này không có nhãn riêng,
 *        nhãn của nó là dòng `veNhan()` ngay trên
 * @param {'con'|'chaMe'} phia  đọc từ phía nào
 */
function oQuanHeMoi(nhan, phia) {
  const boc = document.createElement('div');
  boc.style.cssText = 'margin-top:6px;display:flex';

  // `maCu` là 'birth' chứ không phải chuỗi rỗng: đây là quan hệ CHẶT nhất, và
  // mặc định phải là thứ bật đủ mọi phép rà lên. Mặc định lỏng là mặc định im.
  const chon = oChonQuanHe(nhan, 'birth', phia, () => {});
  o.quanHe = chon;

  boc.append(chon);
  return boc;
}

/**
 * Mã quan hệ đang chọn. Không có ô — hoặc ô mang một mã lạ — thì `'birth'`,
 * cùng đúng phép chuẩn hoá mà `union.addChild` dùng khi ghi.
 */
function docQuanHeMoi() {
  const v = o.quanHe ? String(o.quanHe.value || '') : '';
  return QUAN_HE_CON_NHAN.some((x) => x.ma === v) ? v : 'birth';
}


/**
 * Khối XOÁ ở CUỐI THÂN form sửa hồ sơ (22/08/2026).
 *
 * Chủ dự án: *"trong phần chỉnh sửa mỗi người, gia đình đang chọn cũng có thêm
 * nút xoá"*. Trước hôm nay, xoá một người chỉ tới được từ vành vòng tròn.
 *
 * --- BA quyết định -------------------------------------------------------
 *
 * 1. **KHÔNG đặt nút này vào hàng chân cạnh nút *Lưu*.** Hàng chân của form
 *    này DÍNH ĐÁY (`position:sticky`) và luôn nằm dưới ngón cái suốt lúc
 *    người ta cuộn qua ba chục ô nhập. Một nút xoá nằm sẵn ở đó, cách nút
 *    *Lưu* đúng 8px, là chuyện sớm muộn.
 *
 *    Chỗ đúng là CUỐI THÂN form: phải cuộn hết mọi ô mới tới, và ở đó nó đứng
 *    một mình sau một đường kẻ.
 *
 * 2. **CHỈ mọc ở chế độ SỬA.** Form đang THÊM một người mới thì chưa có bản
 *    ghi nào để mà xoá — nút *Huỷ* mới là thứ đúng, và nó đã có sẵn.
 *
 * 3. **Nó chỉ là CỬA, không phải việc.** Hộp xác nhận, phép đếm hậu quả và
 *    đường hoàn tác đều nằm trong `xoaNguoi()` — luật 8, viết từ bước 21.
 *    Chép một bản thứ hai ở đây là tới ngày một bản được vá còn bản kia không.
 *
 * @returns {HTMLElement[]} rỗng khi không phải chế độ sửa, hoặc không đủ quyền.
 */
function veKhoiXoaNguoi(nguoi) {
  if (N.cheDo !== 'sua' || !nguoi || !nguoi.id) return [];
  if (!suaDuoc()) return [];

  const vach = document.createElement('div');
  vach.style.cssText = 'margin-top:22px;border-top:1px solid var(--sd-vien-nhat,#f0ebe4);padding-top:14px';

  const nhan = document.createElement('div');
  nhan.textContent = 'Xoá khỏi gia phả';
  nhan.style.cssText =
    'font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--sd-chu-phu,#8a8078);margin-bottom:6px';

  const giai = document.createElement('div');
  giai.textContent =
    'Xoá mềm: bản ghi vẫn nằm nguyên trong file, chỉ mang thêm một cái cờ, và ' +
    'sơ đồ thôi vẽ ra. Lấy lại được bất cứ lúc nào từ thùng rác.';
  giai.style.cssText = 'font-size:12px;line-height:1.5;color:var(--sd-chu-phu,#8a8078);margin-bottom:8px';

  const nut = document.createElement('button');
  nut.type = 'button';
  nut.dataset.viec = 'xoa-nguoi';
  nut.textContent = 'Xoá ' + tenNguoi(nguoi.id) + ' khỏi gia phả';
  nut.style.cssText = KIEU_NUT_CHAN +
    'width:100%;text-align:center;' +
    'background:var(--sd-do-nen,#fbf0ec);color:var(--sd-do,#8a3a2a);border:1px solid var(--sd-do-vien,#f0d8d0);font-weight:600';

  // ⚠ Giữ lấy `N.xuLyNgoai` TRƯỚC khi đóng form: `closePersonForm()` đặt nó về
  // rỗng, nên đọc sau đó thì đường `onDaLuu` biến mất và sơ đồ không vẽ lại.
  nut.addEventListener('click', () => {
    const xuLy = N.xuLyNgoai;
    closePersonForm();
    xoaNguoi(nguoi.id, xuLy);
  });

  vach.append(nhan, giai, nut);
  return [vach];
}

// ============================================================
// Đọc form và lưu
// ============================================================

/**
 * Lưu. Trình tự bắt buộc:
 *   1. Chạy validate.validateAll
 *   2. Nếu có error   -> dừng, hiện lỗi
 *   3. Nếu có warning -> hỏi người dùng có tiếp tục không
 *   4. Gọi repo.luuCay
 *   5. Nếu trả về { lyDo:'xungdot' } -> hiện "người khác vừa sửa,
 *      tải lại trước khi lưu", KHÔNG ghi đè
 */
async function handleSave(nguoi) {
  if (N.dangLuu) return;

  const luc = stampNow();
  const boi = (state.phien && state.phien.email) || '';

  const thayDoi = gomThayDoi();

  // Bản ghi mới tính đúng MỘT lần, dùng cho cả phép rà lẫn lần ghi — luật 1
  // (sổ tay). `updatePerson` là hàm thuần, `state.tree` không bị đụng tới.
  const kq = updatePerson(state.tree, nguoi.id, thayDoi, { boi, luc });
  if (!kq) { hienNhan('Không tìm thấy bản ghi của người này nữa. Tải lại trang rồi thử lại.', true); return; }

  // Ảnh áp SAU hồ sơ, trên chính cây mà `updatePerson` vừa trả về — xem
  // `apThayDoiAnh()`. Từ đây trở xuống chỉ dùng bốn biến `…Cuoi`.
  const anh       = apThayDoiAnh(kq.tree, nguoi.id, { boi, luc });
  const sauAnh    = anh ? anh.tree   : kq.tree;
  const nguoiCuoi = anh ? anh.person : kq.person;

  // Khối QUAN HỆ nối đuôi vào cây mà hai bước trên vừa trả về — xem
  // `apThayDoiQuanHe`. Nó KHÔNG đụng bản ghi người, chỉ đụng các cặp.
  const qh        = apThayDoiQuanHe(sauAnh);
  const cayCuoi   = qh.tree;
  const diffCuoi  = Object.assign({}, kq.diff, anh ? anh.diff : null, qh.diff);

  // ⚠ Đổi MỖI ảnh cũng là một thay đổi. Xét `kq.thayDoi` một mình thì bấm Lưu
  // sau khi chọn ảnh sẽ nghe câu "chưa có gì thay đổi" — mà ảnh thì đã nằm
  // trên Drive rồi, nên người dùng có mọi lý do để tin là mình vừa mất nó.
  // Cùng lý lẽ cho quan hệ: đổi MỖI một ô chọn cũng là một thay đổi.
  if (!kq.thayDoi && !anh && qh.capDoi.length === 0) {
    hienNhan('Chưa có gì thay đổi so với bản đang lưu, nên không cần lưu lại.', false);
    return;
  }

  // Luật 2: rà trên cây MỚI với chỉ mục MỚI. Đưa bản đang gõ dở vào bằng
  // `{ person }` thì các phép soi quan hệ vẫn đọc năm sinh cũ trong `index`.
  const indexMoi = buildIndex(cayCuoi);
  const raSoat = validateAll(cayCuoi, indexMoi, 'person', { personId: nguoi.id });

  if (!raSoat.canSave) {
    hienNhan('Chưa lưu được — có chỗ không thể đúng được:', true,
             raSoat.errors.map((m) => m.message));
    return;
  }

  if (raSoat.warnings.length > 0 && !N.daXemCanhBao) {
    N.daXemCanhBao = true;
    N.nutLuu.textContent = 'Vẫn lưu';
    hienNhan('Có chỗ đáng xem lại. Gia phả cũ có những chuyện thật mà nghe như ' +
             'lỗi, nên app không chặn — bấm "Vẫn lưu" nếu bạn biết là đúng:', false,
             raSoat.warnings.map((m) => m.message));
    return;
  }

  N.dangLuu = true;
  N.nutLuu.disabled = true;
  N.nutLuu.style.opacity = '.45';
  hienNhan('Đang lưu…', false);

  // Luật 3: `repo.luuCay()` nhận HÀM SỬA và chạy nó trên bản sao của cây. Bản
  // ghi thay vào là `nguoiCuoi` — đúng bản vừa được rà, không phải một bản
  // tính lại lần nữa.
  //
  // Luật 4: MỘT lần lưu duy nhất, mang cả bản ghi người lẫn bản ghi ảnh. Lưu
  // hai lần thì lần thứ hai hỏng sẽ để lại `photoFileId` trỏ vào một tấm ảnh
  // không có trong kho.
  const nguoiMoi = nguoiCuoi;
  const anhThem  = anh ? anh.themVao : [];
  const anhGoRa  = anh ? anh.goRa    : [];
  const capMoi   = qh.capDoi;
  let ketQua;
  try {
    ketQua = await luuCay(
      (cay) => {
        const ds = Array.isArray(cay.persons) ? cay.persons : [];
        const i = ds.findIndex((p) => p && p.id === nguoi.id);
        if (i >= 0) ds[i] = JSON.parse(JSON.stringify(nguoiMoi));

        // Các cặp bị khối Quan hệ đụng tới. THAY THẾ chứ không thêm mới: mọi
        // cặp ở đây đều đã có sẵn trong cây — `updateChildRelation` và
        // `updateUnion` đều trả về null khi không tìm ra cặp, nên không mục
        // nào tới được đây mà chưa tồn tại.
        for (const u of capMoi) {
          if (!Array.isArray(cay.unions)) cay.unions = [];
          const j = cay.unions.findIndex((x) => x && x.id === u.id);
          if (j >= 0) cay.unions[j] = JSON.parse(JSON.stringify(u));
        }

        if (anhThem.length > 0 || anhGoRa.length > 0) {
          if (!Array.isArray(cay.media)) cay.media = [];
        }

        // ẢNH MỚI — thêm vào kho. Chốt chặn cuối, cùng lý lẽ với mã người ở
        // `handleAddChild`: mã ảnh sinh từ cây lúc bấm Lưu, còn hàm này chạy
        // trên bản sao của cây LÚC GỬI. Hai cây lệch nhau thì thà hỏng lần lưu
        // còn hơn ghi hai bản ghi ảnh trùng mã.
        for (const m of anhThem) {
          if (cay.media.some((x) => x && x.id === m.id)) {
            throw new Error('Mã ảnh ' + m.id + ' vừa được dùng cho một tấm khác. ' +
                            'Tải lại trang rồi gắn ảnh lại.');
          }
          cay.media.push(JSON.parse(JSON.stringify(m)));
        }

        // ẢNH GỠ — THAY THẾ bản ghi cũ, không thêm mới và không xoá khỏi mảng:
        // gỡ ảnh là đặt cờ `deleted`, luật 3 của `domains/media.js`. Không tìm
        // ra bản ghi thì bỏ qua, không ném lỗi — người khác vừa gỡ đúng tấm ấy
        // là một cuộc đua vô hại, kết quả cuối vẫn là tấm ảnh bị gỡ.
        for (const m of anhGoRa) {
          const k = cay.media.findIndex((x) => x && x.id === m.id);
          if (k >= 0) cay.media[k] = JSON.parse(JSON.stringify(m));
        }
      },
      {
        action: 'update',
        target: nguoi.id,
        note:   'Sửa hồ sơ ' + fullName(nguoiMoi) + ' bằng form nhập liệu.' +
                keThayDoiAnh(anh) +
                keThayDoiQuanHe(qh),
        diff:   diffCuoi,
      }
    );
  } catch (e) {
    ketQua = { ok: false, loi: e && e.message ? e.message : String(e) };
  }

  N.dangLuu = false;
  if (!N.lopPhu) return;   // người dùng đã đóng form trong lúc chờ máy chủ

  if (ketQua && ketQua.ok) {
    closePersonForm();
    if (N.xuLyNgoai.onDaLuu) N.xuLyNgoai.onDaLuu(nguoi.id);
    return;
  }

  N.nutLuu.disabled = false;
  N.nutLuu.style.opacity = '1';

  if (ketQua && ketQua.lyDo === 'xungdot') {
    hienNhan('Người khác vừa sửa đúng bản ghi này trong lúc bạn đang gõ — có ' +
             'thể họ sửa từ một gia phả khác cùng chứa người ấy — nên app KHÔNG ' +
             'ghi đè lên bản của họ. Thay đổi của bạn chưa được lưu. Chép lại ' +
             'phần vừa gõ ra chỗ khác, tải lại trang, rồi sửa lại.', true);
    return;
  }
  hienNhan((ketQua && ketQua.loi) || 'Chưa lưu được, mà máy chủ không nói rõ vì sao.', true);
}

/**
 * Thêm một người con. Trình tự giống `handleSave`, khác ba chỗ:
 *   - dựng cây mới bằng BA hàm domains nối đuôi nhau (`dungCayThemCon`);
 *   - rà bằng CẢ HAI nhánh `'person'` và `'child'` — luật 5 (sổ tay);
 *   - gửi lên MỘT lần lưu duy nhất, mang cả người lẫn union — luật 4.
 */
async function handleAddChild() {
  if (N.dangLuu) return;

  const luc    = stampNow();
  const boi    = (state.phien && state.phien.email) || '';
  const quanHe = docQuanHeMoi();

  if (noiVao && (await keoQuaQuanHeCu('con', noiVao.chaMeId, quanHe)) !== undefined) return;

  const dung = dungCayThemCon(state.tree, gomThayDoi(), quanHe, { boi, luc });
  if (!dung) {
    hienNhan('Không nối được người con vào chỗ này. Có thể gia phả vừa thay đổi ' +
             'trong lúc form đang mở. Tải lại trang rồi thử lại.', true);
    return;
  }

  // Thứ tự anh chị em: tính TRƯỚC phép rà, và nếu người dùng đã chọn "sắp xếp
  // lại" thì áp dụng ngay tại đây — luật 1 đòi thứ được rà phải đúng là thứ
  // được ghi, nên không được sắp xếp sau khi rà xong.
  const thuTu = thuTuConTheoTuoi(dung.tree, dung.union.id);
  const lechThuTu = !!(thuTu && !thuTu.hopLe && thuTu.daDoi.indexOf(dung.person.id) >= 0);

  if (lechThuTu && sapXepLai) {
    const kqSap = reorderChildren(dung.tree, dung.union.id, thuTu.thuTuMoi);
    if (kqSap) {
      dung.tree  = kqSap.tree;
      dung.union = kqSap.union;
      Object.assign(dung.diff, kqSap.diff);
    }
  }

  // Luật 2 vẫn nguyên giá trị: rà trên CÂY MỚI với chỉ mục MỚI. Ở đây nó còn
  // bắt buộc hơn lúc sửa — người con này chưa hề tồn tại trong `state.index`,
  // nên rà bằng chỉ mục cũ thì mọi phép soi quan hệ đều không thấy gì.
  const indexMoi = buildIndex(dung.tree);
  const raSoat = gopRaSoat(
    raSoatNguoiKhiThem(dung.tree, indexMoi, dung.person.id),
    validateAll(dung.tree, indexMoi, 'child',
                { childId: dung.person.id, unionId: dung.union.id })
  );

  if (!raSoat.canSave) {
    hienNhan('Chưa thêm được — có chỗ không thể đúng được:', true,
             raSoat.errors.map((m) => m.message));
    return;
  }

  const canhBao = loiNhacCuaForm().concat(raSoat.warnings.map((m) => m.message));
  if (canhBao.length > 0 && !N.daXemCanhBao) {
    N.daXemCanhBao = true;
    N.nutLuu.textContent = 'Vẫn thêm';
    hienNhan('Có chỗ đáng xem lại. Gia phả cũ có những chuyện thật mà nghe như ' +
             'lỗi, nên app không chặn — bấm "Vẫn thêm" nếu bạn biết là đúng:', false, canhBao);
    return;
  }

  // Câu hỏi thứ tự anh chị em: BA lựa chọn, không phải hai — nên nó có khối
  // riêng chứ không đi chung đường "Vẫn thêm" ở trên.
  if (lechThuTu && !daXemThuTu) {
    hoiThuTuAnhEm(thuTu, dung);
    return;
  }

  N.dangLuu = true;
  N.nutLuu.disabled = true;
  N.nutLuu.style.opacity = '.45';
  hienNhan('Đang lưu…', false);

  const nguoiMoi = dung.person;
  const unionMoi = dung.union;
  // b124a — người ĐÃ CÓ ở cây khác thì `nguoiMoi` chỉ là một mã trần
  // (`dungNguoiCoSan()`), không có gì để `fullName()` đọc; lấy tên thật từ
  // chính dòng gợi ý người dùng vừa chọn.
  const tenMoi   = nguoiCoSanChon ? nguoiCoSanChon.ten
    : (coGiaTri(fullName(nguoiMoi)) ? fullName(nguoiMoi) : nguoiMoi.id);

  let ketQua;
  try {
    ketQua = await luuCay(
      (cay) => {
        if (!Array.isArray(cay.persons)) cay.persons = [];
        if (!Array.isArray(cay.unions))  cay.unions  = [];

        // b124a — người ĐÃ CÓ ở cây khác: KHÔNG ghi bản ghi người, chỉ ghi
        // quan hệ. Bản ghi ấy thuộc cây kia; gửi lên là upsert ĐÈ lên nó bằng
        // một mã gần như rỗng. Máy chủ tự thêm vào `tree_persons` của cây này
        // — xem `so-tay/luu-du-lieu.md`.
        if (!nguoiCoSanChon) {
          // Chốt chặn cuối: mã người mới được sinh từ cây lúc mở form, còn hàm
          // này chạy trên bản sao của cây LÚC LƯU. Hai cây ấy lệch nhau thì thà
          // hỏng lần lưu còn hơn ghi hai người trùng mã — `buildIndex()` ném lỗi
          // khi gặp mã trùng, và lúc đó app không mở lại được nữa.
          if (cay.persons.some((p) => p && p.id === nguoiMoi.id)) {
            throw new Error('Mã ' + nguoiMoi.id + ' vừa được dùng cho một người khác. ' +
                            'Tải lại trang rồi thêm lại.');
          }
          cay.persons.push(JSON.parse(JSON.stringify(nguoiMoi)));
        }

        const i = cay.unions.findIndex((u) => u && u.id === unionMoi.id);
        if (i >= 0) cay.unions[i] = JSON.parse(JSON.stringify(unionMoi));
        else        cay.unions.push(JSON.parse(JSON.stringify(unionMoi)));
      },
      {
        action: 'create',
        target: nguoiMoi.id,
        note:   'Thêm ' + (quanHe === 'adopted' ? 'con nuôi ' : 'người con ') + tenMoi +
                ' vào ' + unionMoi.id +
                (dung.laUnionMoi ? ' (cặp mới, tạo cùng lúc)' : '') +
                (nguoiCoSanChon ? ' — người ĐÃ CÓ ở cây khác, kéo vào (b124a).'
                                : ' bằng form nhập liệu.'),
        diff:   dung.diff,
      }
    );
  } catch (e) {
    ketQua = { ok: false, loi: e && e.message ? e.message : String(e) };
  }

  N.dangLuu = false;
  if (!N.lopPhu) return;   // người dùng đã đóng form trong lúc chờ máy chủ

  if (ketQua && ketQua.ok) {
    closePersonForm();
    if (N.xuLyNgoai.onDaLuu) N.xuLyNgoai.onDaLuu(nguoiMoi.id);
    return;
  }

  N.nutLuu.disabled = false;
  N.nutLuu.style.opacity = '1';

  if (ketQua && ketQua.lyDo === 'xungdot') {
    hienNhan('Người khác vừa sửa đúng bản ghi này trong lúc bạn đang gõ — có ' +
             'thể họ sửa từ một gia phả khác cùng chứa người ấy — nên app KHÔNG ' +
             'ghi đè lên bản của họ. Người con này CHƯA được thêm. Chép lại ' +
             'phần vừa gõ ra chỗ khác, tải lại trang, rồi thêm lại.', true);
    return;
  }
  hienNhan((ketQua && ketQua.loi) || 'Chưa thêm được, mà máy chủ không nói rõ vì sao.', true);
}

/**
 * Lưu NGƯỜI ĐẦU TIÊN của một gia phả rỗng.
 *
 * Đường ngắn nhất trong bốn đường thêm người, vì không có cặp nào phải dựng:
 * `createPerson` một lần là xong. Nhưng nó có một việc mà ba đường kia không
 * có — ghi `tree.rootPersonId`. Không ghi thì lần mở app sau,
 * `repo.chonNguoiTrungTam` phải rơi xuống nước thứ ba *"lấy đại người đầu
 * tiên trong chỉ mục"*, và cái gốc mà người dùng vừa cố ý dựng lên thành ra
 * do thứ tự trong mảng quyết định.
 *
 * Không rà quan hệ (`validateAll` nhánh `'child'`) vì chưa có quan hệ nào để
 * rà; nhánh `'person'` vẫn chạy đủ — ngày sinh sau ngày mất là lỗi kể cả khi
 * người ấy đứng một mình.
 */
async function handleAddDauTien() {
  if (N.dangLuu) return;

  const luc = stampNow();
  const boi = (state.phien && state.phien.email) || '';

  const kqP = taoHoacDungNguoi(state.tree, gomThayDoi(), { boi, luc });
  if (!kqP) {
    hienNhan('Không dựng được bản ghi. Tải lại trang rồi thử lại.', true);
    return;
  }

  const indexMoi = buildIndex(kqP.tree);
  const raSoat   = raSoatNguoiKhiThem(kqP.tree, indexMoi, kqP.person.id);

  if (!raSoat.canSave) {
    hienNhan('Chưa thêm được — có chỗ không thể đúng được:', true,
             raSoat.errors.map((m) => m.message));
    return;
  }

  const canhBao = loiNhacCuaForm().concat(raSoat.warnings.map((m) => m.message));
  if (canhBao.length > 0 && !N.daXemCanhBao) {
    N.daXemCanhBao = true;
    N.nutLuu.textContent = 'Vẫn thêm';
    hienNhan('Có chỗ đáng xem lại. Gia phả cũ có những chuyện thật mà nghe như ' +
             'lỗi, nên app không chặn — bấm "Vẫn thêm" nếu bạn biết là đúng:',
             false, canhBao);
    return;
  }

  N.dangLuu = true;
  N.nutLuu.disabled = true;
  N.nutLuu.style.opacity = '.45';
  hienNhan('Đang lưu…', false);

  const nguoiMoi = kqP.person;
  // b124a — cùng lý lẽ với `handleAddChild`: người ĐÃ CÓ ở cây khác thì
  // `nguoiMoi` chỉ là mã trần, lấy tên thật từ dòng gợi ý đã chọn.
  const tenMoi   = nguoiCoSanChon ? nguoiCoSanChon.ten
    : (coGiaTri(fullName(nguoiMoi)) ? fullName(nguoiMoi) : nguoiMoi.id);

  let ketQua;
  try {
    ketQua = await luuCay(
      (cay) => {
        if (!Array.isArray(cay.persons)) cay.persons = [];

        // b124a — người ĐÃ CÓ ở cây khác: KHÔNG ghi bản ghi người, chỉ đặt
        // gốc cây. Xem chú thích đầy đủ ở `handleAddChild`.
        if (!nguoiCoSanChon) {
          // Cùng chốt chặn với `handleAddChild`, và ở đây nó bắt thêm một ca
          // riêng: hai người cùng mở một gia phả rỗng, cả hai cùng bấm thêm
          // người đầu tiên. Cả hai đều sinh ra P0001.
          if (cay.persons.some((p) => p && p.id === nguoiMoi.id)) {
            throw new Error('Mã ' + nguoiMoi.id + ' vừa được dùng cho một người khác. ' +
                            'Tải lại trang rồi thêm lại.');
          }
          cay.persons.push(JSON.parse(JSON.stringify(nguoiMoi)));
        }

        // Chỉ nhận gốc khi chỗ ấy còn trống. Cây đáng lẽ rỗng, nhưng bản sao
        // dùng ở đây là cây LÚC LƯU chứ không phải cây lúc mở form — và ghi đè
        // gốc của một gia phả đã có người là việc hàm này không được phép làm.
        // Gốc trỏ vào người KHÔNG có trong cây cũng tính là còn trống — dấu
        // của lần kéo người hỏng trước `luoc-do/69`, để nó tự lành.
        if (!cay.tree || typeof cay.tree !== 'object') cay.tree = {};
        const gocCu = cay.tree.rootPersonId;
        if (!gocCu || !cay.persons.some((p) => p && p.id === gocCu)) {
          cay.tree.rootPersonId = nguoiMoi.id;
        }
      },
      {
        action: 'create',
        target: nguoiMoi.id,
        note:   'Thêm người đầu tiên của gia phả: ' + tenMoi +
                (nguoiCoSanChon ? ' — người ĐÃ CÓ ở cây khác, kéo vào (b124a).' : '.'),
        diff:   kqP.diff,
      }
    );
  } catch (e) {
    ketQua = { ok: false, loi: e && e.message ? e.message : String(e) };
  }

  // Người ĐÃ CÓ ở cây khác: bản sao vừa lưu không mang bản ghi của họ (cố ý,
  // xem trên), nên chỉ mục không biết họ và `onDaLuu` đứng vào khoảng không.
  // Nạp lại từ máy chủ — `69` đã đưa họ vào `tree_persons`.
  if (ketQua && ketQua.ok && nguoiCoSanChon) {
    try { await napCay(); } catch (e) {
      ketQua = { ok: false, loi: 'Đã lưu, nhưng chưa đọc lại được gia phả. Tải lại trang.' };
    }
  }

  N.dangLuu = false;
  if (!N.lopPhu) return;   // người dùng đã đóng form trong lúc chờ máy chủ

  if (ketQua && ketQua.ok) {
    if (nguoiCoSanChon && !(state.index && state.index.personById.has(nguoiMoi.id))) {
      // Máy chủ chưa có `69`, hoặc không cho kéo người này vào: đừng đóng form
      // như thể đã xong.
      hienNhan('Máy chủ nhận lần lưu nhưng KHÔNG đưa ' + tenMoi + ' vào gia phả này. ' +
               'Báo quản trị hệ thống: cần dán luoc-do/69.', true);
      return;
    }
    closePersonForm();
    if (N.xuLyNgoai.onDaLuu) N.xuLyNgoai.onDaLuu(nguoiMoi.id);
    return;
  }

  N.nutLuu.disabled = false;
  N.nutLuu.style.opacity = '1';

  if (ketQua && ketQua.lyDo === 'xungdot') {
    hienNhan('Người khác vừa sửa đúng bản ghi này trong lúc bạn đang gõ — có ' +
             'thể họ sửa từ một gia phả khác cùng chứa người ấy — nên app KHÔNG ' +
             'ghi đè lên bản của họ. Người này CHƯA được thêm. Tải lại trang ' +
             'rồi xem lại — có thể họ đã thêm người đầu tiên rồi.', true);
    return;
  }
  hienNhan((ketQua && ketQua.loi) || 'Chưa thêm được, mà máy chủ không nói rõ vì sao.', true);
}

/**
 * Thay `createPerson()` khi người đang thêm là người ĐÃ CÓ ở cây khác (b124a):
 * chèn một MÃ TRẦN vào bản sao của cây để `createUnion`/`addChild`/`addPartner`
 * — cả ba chỉ đọc `id` và `deleted` của người, xem đầu ba hàm ấy ở
 * `domains/union.js` — coi là "đã tồn tại", KHÔNG dựng bản ghi thật. Trả cùng
 * hình dạng `{tree, person, diff}` với `createPerson()` để mọi hàm `dungCayThem*`
 * dưới đây dùng chung đúng một dòng gọi, không phải rẽ nhánh.
 *
 * ⚠ `diff` rỗng CỐ Ý: không có gì thay đổi ở BẢN GHI NGƯỜI cả — người này
 * không được ghi. Nơi gọi cuối cùng (ba hàm `handleAdd*`) phải tự biết ĐỪNG
 * đưa `person` này vào phần `persons.luu` của lần lưu — xem
 * `so-tay/luu-du-lieu.md` mục "KÉO người cây khác VÀO cây này".
 */
function dungNguoiCoSan(tree, id) {
  if (!tree || !Array.isArray(tree.persons) || !id) return null;
  if (tree.persons.some((p) => p && p.id === id)) return null;   // đã ở cây này rồi
  const stub = { id, deleted: false };
  return { tree: Object.assign({}, tree, { persons: tree.persons.concat([stub]) }),
           person: stub, diff: {} };
}

/**
 * Người ĐÃ CÓ (cây khác) mà quan hệ đang khai ĐÃ nằm sẵn trong máy chủ, đúng
 * loại ấy → trả hôn nhân cũ; khác loại hoặc chưa có → null (b128b, chủ dự án
 * bấm 24/09: thêm vợ *Sáng* cho *lê tình thương* ở TH957, cặp U0262 đã có ở
 * T388 → trigger `31` chặn vì app đẻ cặp THỨ HAI).
 * Khai lại đúng sự thật đã có không phải sửa quan hệ — chỉ kéo người vào cây.
 * Đọc `state.tree` (nhóm THÔNG TIN, đủ quan hệ ra ngoài cây), không đọc chỉ mục vẽ.
 *   loai 'banDoi' : `mocId` và `nguoiId` cùng là vợ/chồng một cặp
 *   loai 'chaMe'  : `nguoiId` là vợ/chồng của cặp có con `mocId`
 *   loai 'con'    : `mocId` là vợ/chồng của cặp có con `nguoiId`
 * ⚠ Cha mẹ – con phải khớp CẢ loại (`quanHe`: đẻ · nuôi · …). Đang là con nuôi
 *   mà khai con đẻ là khai KHÁC sự thật → null → đi đường cũ, `31` chặn.
 */
function quanHeDaCoSan(loai, mocId, nguoiId, quanHe) {
  const ds = (state.tree && Array.isArray(state.tree.unions)) ? state.tree.unions : [];
  const laCon = (u, id) => Array.isArray(u.children) && u.children.some((c) =>
    c && c.personId === id && (c.relation || 'birth') === (quanHe || 'birth'));
  const laCap = (u, id) => Array.isArray(u.partners) && u.partners.includes(id);
  return ds.find((u) => u && !u.deleted && (
    loai === 'banDoi' ? laCap(u, mocId) && laCap(u, nguoiId)
    : loai === 'chaMe' ? laCap(u, nguoiId) && laCon(u, mocId)
    : laCap(u, mocId) && laCon(u, nguoiId))) || null;
}

/**
 * Kéo người đã có vào cây QUA quan hệ cũ `u`: gửi nguyên bản ghi vùng biên của
 * họ (đủ cột + đúng `revision`), không gửi quan hệ nào. `luu_cay()` (`32`) nhận
 * người gửi kèm vào `v_keo_vao`; cặp `u` tự thành cặp trong cây.
 * Trả `undefined` = không làm (không phải ca này) → nơi gọi đi đường cũ.
 */
async function keoQuaQuanHeCu(loai, mocId, quanHe) {
  if (!nguoiCoSanChon) return undefined;
  const u = quanHeDaCoSan(loai, mocId, nguoiCoSanChon.id, quanHe);
  if (!u) return undefined;
  const banGhi = ((state.tree && state.tree.vanhDai) || []).find((p) => p && p.id === nguoiCoSanChon.id);
  if (!banGhi) return undefined;   // không có bản ghi đủ cột → đường cũ, máy chủ tự báo

  N.dangLuu = true;
  N.nutLuu.disabled = true;
  N.nutLuu.style.opacity = '.45';
  hienNhan('Đang lưu…', false);
  const ketQua = await ghiBanGhi(banGhi, [], {
    action: 'create',
    target: banGhi.id,
    note:   'Kéo ' + nguoiCoSanChon.ten + ' vào gia phả này — quan hệ với ' +
            tenNguoi(mocId) + ' đã có sẵn ở ' + u.id + ', không khai lại.',
    diff:   {},
  });
  N.dangLuu = false;
  if (!N.lopPhu) return ketQua;
  if (ketQua && ketQua.ok) {
    closePersonForm();
    if (N.xuLyNgoai.onDaLuu) N.xuLyNgoai.onDaLuu(banGhi.id);
    return ketQua;
  }
  N.nutLuu.disabled = false;
  N.nutLuu.style.opacity = '1';
  hienLoiGhi(ketQua, 'Người này CHƯA được thêm.');
  return ketQua;
}

/** Một dòng gọi cho cả bốn nơi từng gọi thẳng `createPerson()` — b124a. */
function taoHoacDungNguoi(tree, thayDoi, ghiNhan) {
  return nguoiCoSanChon ? dungNguoiCoSan(tree, nguoiCoSanChon.id)
                        : createPerson(tree, thayDoi, ghiNhan);
}

/**
 * Dựng cây mới mang đủ ba thay đổi, bằng ba hàm thuần nối đuôi nhau.
 *
 * ⚠ THỨ TỰ LÀ BẮT BUỘC và không hoán được: `nextId()` đọc cây, nên mỗi hàm phải
 * nhận CÂY TRẢ VỀ của hàm trước. Chạy cả ba trên cùng một cây cũ thì `addChild`
 * không tìm thấy union vừa tạo.
 *
 * @returns {{tree:object, person:object, union:object,
 *            laUnionMoi:boolean, diff:object}|null}
 */
function dungCayThemCon(cay, thayDoi, quanHe, ghiNhan) {
  if (!cay || !noiVao) return null;

  let tree = cay;
  let unionId = noiVao.unionId || '';
  const diff = {};

  if (!unionId) {
    const kqU = createUnion(tree, [noiVao.chaMeId], {});
    if (!kqU) return null;
    tree = kqU.tree;
    unionId = kqU.union.id;
    Object.assign(diff, kqU.diff);
  }

  const kqP = taoHoacDungNguoi(tree, thayDoi, ghiNhan);
  if (!kqP) return null;
  tree = kqP.tree;
  Object.assign(diff, kqP.diff);

  const kqC = addChild(tree, unionId, kqP.person.id, quanHe);
  if (!kqC) return null;
  tree = kqC.tree;
  Object.assign(diff, kqC.diff);

  return {
    tree,
    person:     kqP.person,
    union:      kqC.union,
    laUnionMoi: !noiVao.unionId,
    diff,
  };
}

/**
 * Gộp kết quả của hai lượt rà thành một.
 *
 * Hai nhánh `'person'` và `'child'` chồng lấn nhau, nên cùng một lỗi hiện ra
 * hai lần nếu không gộp — mà một danh sách kể hai lần cùng một chuyện thì người
 * đọc tưởng gia phả có hai chỗ hỏng.
 *
 * ⚠ `counts` ở đây là TỔNG của hai lượt, tức có đếm trùng. Nó dùng để gỡ lỗi,
 * KHÔNG dùng làm con số của bản báo cáo rà soát — bản báo cáo chạy nhánh
 * `'tree'` một lượt duy nhất và mới là chỗ con số có nghĩa.
 */
/**
 * Nhánh `'person'` của `validateAll()`, NHƯNG bỏ qua khi người đang thêm là
 * người ĐÃ CÓ ở cây khác (b124a) — bản ghi ấy chỉ là một mã trần trong cây
 * tạm (`dungNguoiCoSan()`), không có tên hay ngày tháng gì để rà; rà soát
 * bản ghi THẬT của họ đã diễn ra từ lúc bản ghi ấy được tạo, ở cây kia.
 */
function raSoatNguoiKhiThem(tree, index, personId) {
  if (nguoiCoSanChon) {
    return { canSave: true, errors: [], warnings: [], skipped: [],
             counts: { total: 0, ok: 0, error: 0, warning: 0, skip: 0 } };
  }
  return validateAll(tree, index, 'person', { personId });
}


/**
 * Câu hỏi thứ tự anh chị em — BA lựa chọn.
 *
 * Hiện ra khi người con vừa thêm **lớn tuổi hơn** một anh chị em đang đứng
 * trước mình. Không chặn: thứ tự anh em trong gia phả không phải lúc nào cũng
 * theo tuổi (con vợ cả chép trước con vợ thứ là lệ có thật), nên app hỏi chứ
 * không tự quyết.
 *
 * Nút thứ hai sắp lại **cả union**, không chỉ chỗ người mới — sắp nửa vời thì
 * lần sau lại phải hỏi tiếp. Người con **không đọc được năm sinh thì không bị
 * dịch chỗ**, xem ghi chú của `thuTuConTheoTuoi`.
 */
function hoiThuTuAnhEm(thuTu, dung) {
  const ten = (id) => tenTrongCay(dung.tree, id);
  const nam = (id) => (thuTu.nam.has(id) ? thuTu.nam.get(id) : null);
  const ke  = (ds) => ds.map((id) => ten(id) + (nam(id) ? ' (' + nam(id) + ')' : ''))
                        .join('  ·  ');

  const moiId  = dung.person.id;
  const namMoi = nam(moiId);
  const dungTruoc = thuTu.thuTuHienTai
    .slice(0, thuTu.thuTuHienTai.indexOf(moiId))
    .filter((id) => nam(id) !== null && namMoi !== null && nam(id) > namMoi);

  const cau = ten(moiId) + (namMoi ? ' sinh năm ' + namMoi : '') +
              ', lớn tuổi hơn ' +
              (dungTruoc.length === 1 ? ten(dungTruoc[0]) : dungTruoc.length + ' người') +
              ' đang đứng trước trong hàng anh chị em. Bạn muốn làm gì?';

  hienNhan(cau, false, [
    'Thứ tự hiện nay: ' + ke(thuTu.thuTuHienTai),
    'Nếu sắp lại theo tuổi: ' + ke(thuTu.thuTuMoi),
  ]);

  const hang = document.createElement('div');
  hang.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:10px';

  hang.append(
    nutChon('Vẫn thêm, giữ nguyên thứ tự', true, () => {
      daXemThuTu = true; sapXepLai = false; handleAddChild();
    }),
    nutChon('Thêm và sắp xếp lại theo tuổi', false, () => {
      daXemThuTu = true; sapXepLai = true; handleAddChild();
    }),
    nutChon('Huỷ bỏ — quay lại sửa', false, () => {
      // KHÔNG đóng form: người ta vừa gõ xong cả bản ghi, và nhiều khả năng chỉ
      // muốn sửa lại một con số năm sinh. Đóng form ở đây là lấy mất công của họ.
      daXemThuTu   = false;
      sapXepLai    = false;
      N.daXemCanhBao = false;
      N.nutLuu.textContent = 'Thêm người con';
      hienNhan('Chưa thêm gì cả. Sửa lại rồi bấm "Thêm người con".', false);
    }),
  );
  N.khoiKetQua.append(hang);
}



/**
 * Lời nhắc của RIÊNG màn hình này — không phải phép rà thứ mười.
 *
 * Chín luật sống ở `domains/validate.js` và chỉ ở đó. Cái này thuộc về form vì
 * nó nói về một chuyện chỉ form biết: người dùng vừa bấm thêm mà chưa gõ chữ
 * nào. Bản ghi không tên là HỢP LỆ trong gia phả — *"con thứ ba của cụ Bá"* là
 * bản ghi thật — nên không được chặn. Nhưng app chưa có đường xoá người, nên
 * một cú chạm nhầm để lại một cái ô trống vĩnh viễn giữa sơ đồ.
 */
function loiNhacCuaForm() {
  const ra = [];
  const coTen = ['surname', 'middle', 'given'].some((k) => coGiaTri(docO(k)));
  if (!coTen) {
    ra.push('Bạn chưa gõ tên nào cả. Người không tên vẫn ghi được — gia phả cũ ' +
            'có thật những người chỉ còn nhớ là "con thứ ba của cụ" — nhưng app ' +
            'chưa có cách xoá người đã thêm, nên xin xem lại một lần nữa.');
  }
  // Luật 12: ô thứ bậc gõ sai thì nói ra, đừng lặng lẽ ghi thứ 1.
  return ra.concat(loiThuBacGoSai());
}

/**
 * Gom những gì người dùng vừa gõ thành khối `changes` của `updatePerson`.
 *
 * Gửi CẢ những ô không đổi — `updatePerson` tự so với bản cũ và chỉ ghi vào
 * `diff` phần thật sự khác. Nhờ vậy form không phải nhớ giá trị ban đầu của
 * từng ô, và không có đường nào để hai bên nghĩ khác nhau về "cái gì đã đổi".
 */
function gomThayDoi() {
  return {
    name: {
      surname: docO('surname'),
      middle:  docO('middle'),
      given:   docO('given'),
    },

    // TÊN PHỤ đi thành CẢ danh sách, không đi thành từng phép thêm/bớt — lý lẽ
    // ở `domains/person.datTenPhu`. Hàng người dùng bỏ trống chữ được `datTenPhu`
    // loại đi, nên form không phải lọc trước.
    altNames: tenPhu.map(phanTenPhu),
    sex:         docO('sex'),
    living:      !!(o.living && o.living.checked),
    burialPlace: docO('burialPlace'),
    gio:         docO('gio'),
    note:        docO('note'),

    // Bộ thông dụng (V03). `chi` đi vào `vn.branch`; phần còn lại nằm phẳng
    // trên `person`. Việc ánh xạ ấy là của `domains/person.updatePerson`.
    // KHÔNG gửi `doi`: vắng khoá thì `datDoi()` để nguyên `vn.generation` cũ.
    title:       docO('title'),
    occupation:  docO('occupation'),
    education:   docO('education'),
    religion:    docO('religion'),
    residence:   docO('residence'),
    nationality: docO('nationality'),
    contact:     docO('contact'),
    chi:         docO('chi'),
    birth: { raw: docO('birth'), place: docO('birthPlace') },
    death: { raw: docO('death'), place: docO('deathPlace') },
  };
}



// ============================================================
// Hàm dùng trong file
// ============================================================

/** Mục tên chính, đọc theo đúng quy tắc của `utils/text.fullName`. */
function mucTenChinh(nguoi) {
  const ds = Array.isArray(nguoi.names) ? nguoi.names : [];
  const muc = ds.find((n) => n && n.type === 'chinh') || ds[0] || {};
  return { surname: muc.surname || '', middle: muc.middle || '', given: muc.given || '' };
}












// ============================================================
// HỘP KHÔNG CÓ Ô NHẬP — dùng chung cho chọn cặp, nối, gỡ nối
// ============================================================
//
// Ba việc của bước 26 đều bắt đầu bằng cùng một hình: một hộp trắng, một câu
// hỏi, vài nút xếp dọc, nút Huỷ ở chân. Gom một chỗ vì lý do đã nói ở
// `KIEU_LOP_PHU`: chép ra ba bản thì ba bản trôi lệch nhau, mà thứ trôi lệch
// đầu tiên bao giờ cũng là `z-index` — và hai hộp của cùng file này chồng lên
// nhau thì người dùng bấm vào cái phía dưới mà không hiểu vì sao không ăn.








// ============================================================
// CHỌN CẶP — một hàm cho cả bốn đường (thêm/nối × cha mẹ/vợ chồng/con)
// ============================================================


// ============================================================
// HỎI THỨ BẬC NGAY LÚC NHẬP — luật 12 (27/08/2026)
// ============================================================
//
// Ba đường tạo ra một cuộc hôn nhân MỚI, và cả ba đi qua đúng hai hàm dưới đây:
//
//   · form *Thêm vợ / chồng*            → `dungCayThemBanDoi`
//   · Kết nối hai người, cặp MỚI        → `dungCayNoi`, nhánh `createUnion`
//   · Kết nối hai người, vào cặp CÓ SẴN → `dungCayNoi`, nhánh `addPartner`
//
// Đường thứ ba cần thêm một bước: `addPartner` cố ý KHÔNG nhận `ranks` (nó chỉ
// làm đúng một việc — đưa một người vào hàng vợ/chồng), nên thứ bậc ghi bằng
// `updateUnion` nối đuôi ngay sau. Cùng đúng lối `updateUnion` + `swapPartnerOrder`
// đã nối đuôi nhau ở form Sửa cặp.
//
// ⚠ BỐN chỗ `createUnion` còn lại KHÔNG hỏi, và đó là chủ ý: cả bốn tạo ra một
// cặp MỘT NGƯỜI để treo người con vào (`dungCayThemCon`, `dungCayThemChaMe`, và
// hai nhánh `'child'`/`'parent'` của `dungCayNoi`). Một cặp chưa có ai làm
// vợ/chồng thì không có vợ cả vợ thứ nào để mà hỏi — con số ấy chỉ sinh ra khi
// có người bước vào, và lúc đó chính đường thứ ba ở trên sẽ hỏi.




// ============================================================
// BA HỘP THOẠI KIỂU MY FAMILY TREE — luật 13 (bước 65, 30/08/2026)
// ============================================================

/** Một hàng có ô tích / ô tròn, kiểu dùng chung cho cả hai khối dưới. */
const KIEU_HANG_TICH =
  'display:flex;align-items:flex-start;gap:9px;margin-top:6px;padding:9px 11px;' +
  'border:1px solid var(--sd-vien,#e6e0d8);border-radius:9px;background:var(--sd-nen,#faf8f5);' +
  'font-size:14px;line-height:1.4;cursor:pointer;touch-action:manipulation';

const KIEU_O_TICH = 'width:18px;height:18px;flex:0 0 auto;margin-top:1px;accent-color:var(--sd-chu,#2a2622)';

/** Dòng chữ nhỏ giải thích, dùng lại ở cả ba khối. */
function dongNhac(chu) {
  const d = document.createElement('div');
  d.textContent = chu;
  d.style.cssText = 'font-size:11px;line-height:1.45;color:var(--sd-chu-phu,#8a8078);margin-top:4px';
  return d;
}

/**
 * ⚠ ĐỔI CHỖ NỐI LÀ XOÁ MỌI CÂU TRẢ LỜI ĐÃ CHO CHO CHỖ NỐI CŨ.
 *
 * `daXemCanhBao` nghĩa là *"tôi đã đọc mấy lời cảnh báo ấy và vẫn muốn thêm"* —
 * mà mấy lời ấy nói về một cặp khác. Giữ lại là để một cú bấm "Vẫn thêm" dành
 * cho câu hỏi A đi qua luôn câu hỏi B. `daXemThuTu`/`sapXepLai` cũng thế: thứ
 * tự anh chị em đếm trong CẶP, đổi cặp là đổi cả hàng anh em.
 *
 * Chữ trên nút phải trả về như cũ, không thì nút còn ghi "Vẫn thêm" trong khi
 * chẳng còn cảnh báo nào trên màn hình.
 */
function quenCauTraLoiCu() {
  N.daXemCanhBao = false;
  daXemThuTu     = false;
  sapXepLai      = false;

  if (N.khoiKetQua) N.khoiKetQua.innerHTML = '';
  if (N.nutLuu && !N.dangLuu) N.nutLuu.textContent = tieuDeForm();

  // Lời "bạn chỉ có quyền xem" nói về CẢ FORM chứ không về chỗ nối, nên nó
  // phải sống lại ngay — nếu không, dọn xong là mất luôn câu duy nhất giải
  // thích vì sao nút lưu đang mờ.
  const canTro = canTroLuu();
  if (canTro) hienNhan(canTro, true);
}

// --- HỘP 1: THÊM CON — "Cha mẹ là ai?" ---------------------------------

/**
 * Khối chọn CẶP CHA MẸ cho người con sắp thêm, đúng cái hộp ở ảnh mẫu
 * `tai-lieu/anh/My Family Tree - them con.png`.
 *
 * @returns {HTMLElement[]} rỗng khi không có gì để chọn
 *
 * ⚠ **LUÔN CÓ MỤC "MỘT MÌNH X", kể cả khi người ấy đã có cặp.** Đây là điều
 * màn hình cũ không làm được, và nó không phải ca hiếm: gia phả cũ đầy những
 * người con mà không còn ai nhớ mẹ là ai. Trước bước 65, người đã có đúng một
 * cặp bị đưa thẳng vào cặp ấy, không có đường nào khai một người con đơn thân —
 * phải thêm vào cặp rồi vào *Sửa thông tin gia đình* gỡ ra.
 *
 * ⚠ **Người CHƯA có cặp nào thì khối này im.** Một câu hỏi chỉ có một câu trả
 * lời là bắt người ta đọc để rồi bấm cái duy nhất — cùng lý lẽ đã dùng cho
 * `chonCap()` và cho ô thứ bậc.
 */
function khoiChonChaMe() {
  const index = state.index;
  if (!index || !noiVao || !noiVao.mocId) return [];

  const mocId = noiVao.mocId;
  const dsCap = getPartnerUnions(index, mocId);
  if (dsCap.length === 0) return [];

  const ten = tenNguoi(mocId);
  const boc = document.createElement('div');
  chonChaMe = { mocId, cacO: [] };

  const themHang = (ma, dong1, dong2, chon) => {
    const nhan = document.createElement('label');
    nhan.style.cssText = KIEU_HANG_TICH;

    const nut = document.createElement('input');
    nut.type = 'radio';
    nut.name = 'giapha-cha-me';
    nut.value = ma;
    nut.checked = chon;
    nut.dataset.chaMeCap = ma;   // mốc cho bài kiểm, xem kiem-ba-hop-thoai.mjs
    nut.style.cssText = KIEU_O_TICH;
    nut.addEventListener('change', () => { if (nut.checked) datChoNoiCon(ma); });
    chonChaMe.cacO.push({ ma, input: nut });

    const chu = document.createElement('span');
    const d1 = document.createElement('div');
    d1.textContent = dong1;
    const d2 = document.createElement('div');
    d2.textContent = dong2;
    d2.style.cssText = 'font-size:12px;color:var(--sd-chu-phu,#8a8078);margin-top:2px';
    chu.append(d1, d2);

    nhan.append(nut, chu);
    boc.append(nhan);
  };

  for (const u of dsCap) {
    const ngoai = capCoNguoiNgoaiCay(u);
    if (!ngoai) { themHang(u.id, keTenPartner(u.id), moTaCap(u), u.id === noiVao.unionId); continue; }
    // Rào thép (b128a): vẫn KỂ cặp này — người dùng biết nó có — nhưng khoá.
    themHang(u.id, ten + '  và  ' + ((ngoai.p && fullName(ngoai.p)) || ngoai.id) + ' (' + ngoai.id + ')',
             'Người kia không thuộc gia phả này — thêm con cho cặp này ở gia phả có cả hai người.',
             false);
    const o = chonChaMe.cacO[chonChaMe.cacO.length - 1];
    o.input.disabled = true;
    o.input.parentElement.style.opacity = '.5';
  }
  themHang('', 'Một mình ' + ten,
           'Chưa biết người kia là ai — app dựng một cặp riêng chỉ có ' + ten + '.',
           !noiVao.unionId);

  boc.append(dongNhac(
    'Trong gia phả này quan hệ cha mẹ – con đi QUA CẶP, nên câu hỏi phải là ' +
    '"cặp nào" chứ không phải "ai". Chọn nhầm thì đổi lại ngay ở đây, không ' +
    'phải đóng form.'));

  return [veNhan('Cha mẹ là ai?'), boc];
}

/** Ghi lựa chọn của khối trên vào `noiVao`. Chuỗi rỗng = một mình người mốc. */
/**
 * Cặp có vợ/chồng ở VÀNH ĐAI (ngoài cây đang mở) không — rào thép b128a.
 * @returns {{id:string, p:object}|null} người ngoài cây đầu tiên
 */
function capCoNguoiNgoaiCay(u) {
  const bien = state.index && state.index.vanhDaiById;
  if (!bien || !u) return null;
  const id = (Array.isArray(u.partners) ? u.partners : []).find((x) => bien.has(x));
  return id ? { id, p: bien.get(id) } : null;
}

function datChoNoiCon(unionId) {
  if (!noiVao || !noiVao.mocId) return;
  if ((noiVao.unionId || '') === unionId) return;

  if (unionId) {
    noiVao.unionId = unionId;
    delete noiVao.chaMeId;
  } else {
    noiVao.unionId = '';
    noiVao.chaMeId = noiVao.mocId;
  }
  quenCauTraLoiCu();
}

// --- HỘP 2 và 3: THÊM VỢ / CHỒNG ---------------------------------------

/** Những người con THẬT của một cặp — bỏ mã trỏ vào người không còn trong chỉ mục. */
function conThatCua(u) {
  const index = state.index;
  return (Array.isArray(u && u.children) ? u.children : [])
    .filter((c) => c && c.personId && index && index.personById.has(c.personId));
}

/**
 * Bảng CON SẴN CÓ của người mốc — hộp thoại thứ hai của ảnh mẫu
 * (`My Family Tree - them vo sau khi them con.png`). Rỗng khi người ấy chưa có
 * con nào, và lúc ấy form thành đúng hộp thoại thứ ba (`… khi chua them con`).
 *
 * @returns {HTMLElement[]}
 *
 * --- Ô TÍCH THEO NGƯỜI, NHẬN THEO CẢ CẶP ------------------------------
 *
 * Xem luật 13. Tích một ô là app tích luôn cả nhóm của cặp ấy và bỏ tích mọi
 * nhóm khác — vì bước vào một cặp là thành cha/mẹ của TẤT CẢ con của cặp ấy,
 * và một người chỉ bước vào được MỘT cặp trong một lần thêm.
 *
 * --- Vì sao chỉ cặp MỘT NGƯỜI mới tích được ---------------------------
 *
 * `addPartner` không nhét được người thứ ba, và trong gia phả này nhiều vợ /
 * nhiều chồng là NHIỀU CẶP chứ không phải một cặp ba người. Con của những cặp
 * đã đủ hai người vẫn được KỂ RA — không kể thì người dùng nhìn danh sách
 * thiếu mất đứa con họ đang nghĩ tới và tưởng app quên mất nó.
 */
function khoiConSanCo() {
  const index = state.index;
  if (!index || !noiVao || !noiVao.banDoiId) return [];

  const mocId = noiVao.banDoiId;
  const dsCap = getPartnerUnions(index, mocId).filter((u) => conThatCua(u).length > 0);
  const tichDuoc = dsCap.filter((u) => soPartner(u) < 2);
  const chiKe    = dsCap.filter((u) => soPartner(u) >= 2);
  if (dsCap.length === 0) return [];

  const ten = tenNguoi(mocId);
  const boc = document.createElement('div');
  conSanCo = [];

  for (const u of tichDuoc) {
    for (const c of conThatCua(u)) {
      // ⚠ Hàng là một `div`, KHÔNG phải một `label` bọc cả hàng. Ô chọn quan hệ
      // nằm trong hàng, mà một `label` bọc quanh nó thì mỗi lần mở danh sách
      // chọn là một lần có nguy cơ lật cả ô tích. Nhãn chỉ ôm ĐÚNG ô tích và
      // cái tên — đúng cặp mà nó nói về.
      const hang = document.createElement('div');
      hang.style.cssText = KIEU_HANG_TICH + ';flex-wrap:wrap;align-items:center';

      const hop = document.createElement('input');
      hop.type = 'checkbox';
      hop.checked = false;
      hop.dataset.conCua = u.id;   // mốc cho bài kiểm
      hop.style.cssText = KIEU_O_TICH + ';margin-top:0';
      hop.addEventListener('change', () => chonNhomCon(u.id, hop.checked));

      // Tên và ô chọn nằm CÙNG MỘT HÀNG, đúng như ảnh mẫu. Bản đầu để ô chọn
      // rộng hết hàng ngay dưới cái tên: hai người con là bốn dòng, năm người
      // con là một bức tường ô chọn che mất chính mấy cái tên phải đọc.
      const nhan = document.createElement('label');
      nhan.style.cssText =
        'display:flex;align-items:center;gap:9px;flex:1 1 140px;min-width:0;' +
        'cursor:pointer;touch-action:manipulation';
      const ten = document.createElement('span');
      ten.textContent = tenNguoi(c.personId);
      ten.style.cssText = 'overflow-wrap:anywhere';
      nhan.append(hop, ten);

      const oQh = oChonQuanHe('Quan hệ với ' + tenNguoi(c.personId),
                              c.relation || 'birth', 'con', () => {});
      oQh.dataset.quanHeCua = c.personId;   // mốc cho bài kiểm — xem ghi chú dưới
      const boQh = document.createElement('div');
      boQh.style.cssText = 'display:flex;flex:0 1 132px;min-width:112px';
      boQh.append(oQh);

      conSanCo.push({ personId: c.personId, unionId: u.id, hop, oQh });
      hang.append(nhan, boQh);
      boc.append(hang);
    }

    boc.append(dongNhac(
      'Mấy người trên là con của cặp ' + u.id + ', cặp mà ' + ten + ' đang đứng ' +
      'một mình. Tích một người là tích cả ' + conThatCua(u).length + ' người ' +
      'của cặp ấy, vì quan hệ cha mẹ – con đi QUA CẶP: bước vào cặp là thành ' +
      'cha/mẹ của tất cả, không có nửa vời.'));
  }

  for (const u of chiKe) {
    const d = document.createElement('div');
    d.textContent = 'Không tích được: ' +
      conThatCua(u).map((c) => tenNguoi(c.personId)).join(' · ') +
      ' (cặp ' + u.id + ' — ' + keTenPartner(u.id) + ' — đã đủ hai người).';
    d.style.cssText =
      'margin-top:6px;padding:9px 11px;font-size:12px;line-height:1.5;' +
      'border:1px dashed var(--sd-vien,#e6e0d8);border-radius:9px;color:var(--sd-chu-phu,#8a8078)';
    boc.append(d);
  }

  boc.append(dongNhac(
    'Không tích ô nào thì app dựng một CẶP MỚI, và người vừa thêm KHÔNG thành ' +
    'cha/mẹ của ai trong danh sách trên — đúng ca người vợ sau không phải mẹ ' +
    'của con chồng.'));

  return [veNhan('Con sẵn có của ' + ten), boc];
}

/**
 * Tích / bỏ tích cả nhóm con của một cặp, và bỏ tích mọi nhóm khác.
 *
 * Một người chỉ bước vào được MỘT cặp trong một lần thêm, nên hai nhóm cùng
 * được tích là một câu app không ghi nổi. Bỏ tích nhóm kia ngay tại chỗ, để
 * người dùng thấy điều đó lúc bấm chứ không đọc nó trong một lời cảnh báo.
 */
function chonNhomCon(unionId, bat) {
  for (const m of conSanCo) m.hop.checked = bat && m.unionId === unionId;
  datChoNoiBanDoi(bat ? unionId : '');
}

/** Ghi chỗ nối của đường thêm vợ/chồng, rồi vẽ lại hai khối phụ thuộc vào nó. */
function datChoNoiBanDoi(unionId) {
  if (!noiVao || (noiVao.unionId || '') === unionId) return;
  noiVao.unionId = unionId;
  quenCauTraLoiCu();
  veLaiThuBac();
  veLaiHonNhan();
}

/**
 * Vẽ lại ô thứ bậc theo chỗ nối HIỆN TẠI.
 *
 * ⚠ Phải vẽ lại chứ không để nguyên, và con số là lý do: `khoiHoiThuBac` đếm
 * *"số cặp đang có + 1"*, mà cặp sắp bước vào thì không được tính vào số ấy —
 * nó chính là cặp đang bàn tới. Người mốc có đúng một cặp một người và người
 * dùng tích nhận con của nó, thì cặp ấy là cặp THỨ NHẤT, và câu hỏi thứ bậc
 * biến mất hẳn (chưa có cặp nào khác để mà xếp thứ).
 *
 * `thuBacNhap` phải dọn trước: nó là mảng THAM CHIẾU tới ô, và ô cũ đã bị gỡ
 * khỏi trang — để lại thì `docThuBacNhap()` đọc một con số không ai còn nhìn
 * thấy nữa.
 */
function veLaiThuBac() {
  if (!khoiThuBac) return;
  khoiThuBac.innerHTML = '';
  xoaThuBacNhap();
  khoiThuBac.append(...khoiHoiThuBac(noiVao.banDoiId, noiVao.unionId || ''));
}

/** Khối *Cuộc hôn nhân này* — trạng thái, ngày và nơi kết hôn. */
function khoiHonNhan() {
  khoiHon = document.createElement('div');
  veLaiHonNhan();
  return [khoiHon];
}

/**
 * ⚠ ĐIỀN SẴN TỪ CẶP SẮP BƯỚC VÀO, KHÔNG PHẢI ĐỂ TRỐNG.
 *
 * Cặp cũ có thể đã mang ngày cưới và nơi cưới. Ba ô trống mà vẫn gửi đi thì
 * `updateUnion` thấy `'1990' → ''` và **xoá mất** thứ đang lưu — người dùng chỉ
 * thêm một người vợ mà mất một ngày cưới, không lời nào báo. Điền sẵn là cách
 * duy nhất giữ đúng luật 1: thứ nhìn thấy trên màn hình đúng là thứ được ghi.
 */
function veLaiHonNhan() {
  if (!khoiHon) return;

  // Thứ người dùng ĐÃ GÕ, đọc trước khi xoá khối. Cặp cũ có ngày cưới thì ngày
  // ấy thắng; cặp cũ để trống thì giữ nguyên chữ người ta vừa gõ. Vẽ lại mà
  // quét trắng hai ô này là lấy mất công của họ vì một cú tích ở khối trên.
  const daGoNgay = docO('marriage');
  const daGoNoi  = docO('marriagePlace');
  khoiHon.innerHTML = '';

  const u = (noiVao && noiVao.unionId && state.index)
    ? state.index.unionById.get(noiVao.unionId) : null;
  const m = (u && u.marriage && typeof u.marriage === 'object') ? u.marriage : null;

  const ngay = (m && coGiaTri(m.raw)) ? m.raw : daGoNgay;
  const noi  = (m && coGiaTri(m.place)) ? m.place : daGoNoi;

  khoiHon.append(veNhan('Cuộc hôn nhân này'));
  khoiHon.append(oChonTrangThaiCap((u && u.status) || 'married'));
  khoiHon.append(oNgay('marriage', { iso: null, raw: ngay, place: '' }, 'Ngày kết hôn'));
  khoiHon.append(oChu('marriagePlace', 'Nơi kết hôn', noi, 'Đình làng Vân, Hà Nam'));
}

/**
 * Ô chọn trạng thái của cặp.
 *
 * ⚠ Mã lạ được THÊM vào danh sách chứ không bị thay — đúng bài học của
 * `oChonQuanHe`: không thêm thì `<select>` tự nhảy về mục đầu tiên, và người
 * dùng chỉ mở form ra xem cũng đủ biến `widowed` của một file GEDCOM nhập vào
 * thành `married`.
 */
function oChonTrangThaiCap(maCu) {
  const boc = document.createElement('div');
  boc.style.cssText = 'margin-top:6px';

  const chon = document.createElement('select');
  chon.setAttribute('aria-label', 'Trạng thái của cặp');
  chon.style.cssText = KIEU_O;

  const ds = TRANG_THAI_CAP.slice();
  if (!ds.some((x) => x.ma === maCu)) ds.push({ ma: maCu, chu: nhanTrangThaiCap(maCu) });

  for (const t of ds) {
    const op = document.createElement('option');
    op.value = t.ma;
    op.textContent = t.chu;
    if (t.ma === maCu) op.selected = true;
    chon.append(op);
  }
  o.tinhTrangCap = chon;

  boc.append(veNhanO('Đang là vợ chồng hay đã ly hôn'), chon);
  return boc;
}

/** Ba ô của khối trên, đọc thành đúng khuôn `createUnion` / `updateUnion`. */
function docKhoiHonNhan() {
  const ma = o.tinhTrangCap ? String(o.tinhTrangCap.value || '') : '';
  const raw = docO('marriage').trim();
  return {
    status: ma || 'married',
    marriage: { raw, iso: parseLooseDate(raw).iso, place: docO('marriagePlace').trim() },
  };
}

/**
 * Ghi lại quan hệ đẻ/nuôi mà người dùng vừa chọn cho từng người con được tích.
 *
 * Chỉ chạm những người con của ĐÚNG cặp được bước vào. `updateChildRelation`
 * tự trả về `thayDoi:false` khi mã không đổi, nên gọi cho cả nhóm là an toàn —
 * nhưng `diff` thì chỉ nở ra ở những chỗ thật sự đổi.
 *
 * @returns {{tree:object}|null}
 */
function apQuanHeConDaChon(cay, unionId, diff) {
  let tree = cay;
  for (const m of conSanCo) {
    if (m.unionId !== unionId || !m.hop.checked) continue;
    const kq = updateChildRelation(tree, unionId, m.personId, String(m.oQh.value || 'birth'));
    if (!kq) return null;
    tree = kq.tree;
    Object.assign(diff, kq.diff);
  }
  return { tree };
}

/**
 * Một dòng cho những cặp mà bảng *Con sẵn có* ĐÃ hỏi và người dùng đã trả lời
 * "không".
 *
 * Lời rà soát *"cặp Uxxxx trùng với Uyyyy"* vẫn hiện — nó là phép rà chung, và
 * hai cặp cùng người thì đáng nhìn lại thật. Nhưng ở đúng ca này nó nghe như
 * app đang trách người dùng về một việc họ vừa cố ý làm. Dòng này nói ra rằng
 * app hiểu câu trả lời của họ, chứ không phải bày thêm một cửa canh nữa.
 */
function veLoiDaHoiOForm(cacCap) {
  if (!N.khoiKetQua || !cacCap || cacCap.length === 0) return;

  const d = document.createElement('div');
  d.textContent =
    'Về ' + cacCap.map((u) => 'cặp ' + u.id).join(' · ') + ': bạn vừa cố ý ' +
    'KHÔNG tích người con nào của nó ở khối "Con sẵn có" — tức người vừa thêm ' +
    'không phải cha/mẹ của họ — nên app dựng một cặp riêng, đúng ý bạn. Bấm ' +
    '"Vẫn thêm" để giữ cặp mới ấy.';
  d.style.cssText =
    'margin-top:10px;padding:7px 10px;font-size:12px;line-height:1.5;' +
    'border-radius:8px;background:var(--sd-nen,#faf8f5);border:1px solid var(--sd-vien-nhat,#f0ebe4);color:var(--sd-chu-vua,#5c554e)';
  N.khoiKetQua.append(d);
}

/**
 * Cặp này đã được hỏi ngay trong form chưa?
 *
 * Luật 13: hỏi lại ở khối cảnh báo một câu người ta vừa trả lời trong form là
 * tự mâu thuẫn — họ vừa cố ý KHÔNG tích mấy người con ấy. Nút *"Nối vào cặp
 * sẵn có"* (bước 63) vì thế chỉ còn giữ đúng phần mà bảng con không kể tới:
 * cặp một người CHƯA CÓ CON, nơi không có hệ quả nào để bày ra thành ô tích.
 */
function capDaHoiOForm(unionId) {
  return conSanCo.some((m) => m.unionId === unionId);
}

// ============================================================
// THÊM CHA / MẸ và THÊM VỢ / CHỒNG — người MỚI
// ============================================================

/**
 * Thêm một người cha hoặc mẹ mới cho `childId`.
 *
 * @param {string} childId
 * @param {{onDaLuu?:function(string)}} [xuLy]
 *
 * ⚠ **KHÔNG hỏi "thêm cha hay thêm mẹ" nữa** (chủ dự án chốt 20/08/2026, ngay
 * sau bước 26). Câu ấy hỏi đúng một thứ mà form ngay sau đó lại hỏi lần thứ
 * hai: **ô giới tính**. Chọn "Nam" trong form *là* nói "đây là cha" — không có
 * cách nào chọn "Nam" mà lại ra người mẹ. Hỏi trước rồi hỏi lại là bắt người ta
 * trả lời hai lần cho một câu, và tệ hơn: hai câu trả lời có thể lệch nhau, lúc
 * ấy app phải chọn tin cái nào.
 *
 * ⚠ Chữ ký khung 15/08 ghi `quickAddParent(childId, sex)`. Nay **không còn
 * `sex`** — và cũng chưa bao giờ có `xuLy` như khung ghi. Cùng loại đính chính
 * với `updatePerson` (bước 18) và `searchPersons` (bước 24): khung là điểm khởi
 * hành, không phải hợp đồng.
 */
export function quickAddParent(childId, xuLy = {}) {
  const index = state.index;
  if (!index || !index.personById.has(childId)) return;

  chonCap('chaMe', childId, xuLy, (unionId) => {
    moForm('themChaMe', NGUOI_TRONG, { childId, unionId }, xuLy);
  });
}

/** Giới tính còn lại của một cặp nam–nữ. Trả rỗng khi không suy ra được. */
const GIOI_NGUOC = { M: 'F', F: 'M' };

/**
 * Thêm một người vợ / chồng mới cho `personId`.
 *
 * ⚠ **KHÔNG hỏi "nối vào cặp nào" nữa, và LUÔN tạo một cặp mới** (chủ dự án
 * chốt 20/08/2026). Cú chạm giữ đã chỉ đúng một người, nên hai người ấy là một
 * cặp — không còn gì để hỏi.
 *
 * Và câu hỏi bị bỏ đi ấy hoá ra còn **nguy hiểm**: lối duy nhất nó mở ra là
 * *"cho người mới vào cặp một người đang có con"*, mà làm thế là **lặng lẽ
 * khẳng định người mới là cha/mẹ của mấy người con đó** — đúng thứ luật 9 cấm.
 * Bỏ câu hỏi vừa gọn tay vừa đóng luôn cái cửa ấy.
 *
 * ⚠ Ca *"bà mẹ nay đã nhớ ra tên chồng"* — cặp một người có con — vẫn làm được,
 * chỉ là **đi từ phía người con**: mở thẻ người con → *Thêm cha / mẹ* → cặp ấy
 * còn một chỗ trống nên vào thẳng. Đó mới là lối đúng, vì ở đó người dùng đang
 * nhìn chính đứa con mà mình sắp gán thêm một người cha.
 *
 * ⚠ **Vá 27/08/2026 — câu hỏi ấy quay lại, nhưng ở CUỐI chứ không ở đầu.** Bỏ
 * hẳn nó thì người dùng đi tới cuối đường mới biết mình vừa dựng một cặp trùng,
 * mà lúc đó chỉ còn "Vẫn thêm" hoặc "Huỷ". Nay khi — và CHỈ khi — cặp sắp dựng
 * trùng với một cặp đã có, hộp cảnh báo mọc thêm nút *"Nối vào cặp Uxxxx sẵn
 * có"*, kể thẳng tên từng người con mà người mới sắp thành cha/mẹ. Xem
 * `veNutNoiVaoCapCu`. Đường mở ra vẫn đúng đường cũ, chỉ khác: nó không còn
 * lặng lẽ, và nó chỉ hiện ra đúng lúc nó có ích.
 *
 * **Giới tính người mới điền sẵn NGƯỢC với người kia, và ô ấy bị khoá** — mở
 * lại bằng công tắc *"hôn nhân đồng giới"*. Người kia mang `sex: 'U'` thì không
 * suy ra được gì: để ô mở, không khoá, không bày công tắc.
 */
export function quickAddSpouse(personId, xuLy = {}) {
  const index = state.index;
  const moc = index && index.personById.get(personId);
  if (!moc) return;

  const gioiNguoc = GIOI_NGUOC[moc.sex] || '';

  moForm('themBanDoi',
         Object.assign({}, NGUOI_TRONG, { sex: gioiNguoc || 'U' }),
         { banDoiId: personId, unionId: '', gioiMoc: moc.sex, gioiNguoc },
         xuLy);
}

/**
 * Lưu của hai chế độ `themChaMe` và `themBanDoi`.
 *
 * Cùng đúng trình tự của `handleAddChild` (luật 1 · 2 · 4 · 5), chỉ khác bộ hàm
 * dựng cây và bộ nhánh rà soát. Không có câu hỏi thứ tự anh chị em — người vừa
 * thêm là cha mẹ hoặc vợ chồng, không đứng trong hàng anh em nào.
 */
async function handleAddNguoiThan() {
  if (N.dangLuu) return;

  const luc    = stampNow();
  const boi    = (state.phien && state.phien.email) || '';
  const quanHe = docQuanHeMoi();
  const laChaMe = N.cheDo === 'themChaMe';

  if (noiVao && (await keoQuaQuanHeCu(laChaMe ? 'chaMe' : 'banDoi',
                                      laChaMe ? noiVao.childId : noiVao.banDoiId,
                                      quanHe)) !== undefined) return;

  const dung = laChaMe
    ? dungCayThemChaMe(state.tree, gomThayDoi(), quanHe, { boi, luc })
    : dungCayThemBanDoi(state.tree, gomThayDoi(), { boi, luc });

  if (!dung) {
    hienNhan('Không nối được người này vào chỗ đã chọn. Có thể gia phả vừa thay ' +
             'đổi trong lúc form đang mở. Tải lại trang rồi thử lại.', true);
    return;
  }

  // Luật 2: rà trên CÂY MỚI với chỉ mục MỚI — người vừa dựng chưa hề có trong
  // `state.index`, nên rà bằng chỉ mục cũ thì mọi phép soi quan hệ mù hết.
  const indexMoi = buildIndex(dung.tree);
  let raSoat = gopRaSoat(
    raSoatNguoiKhiThem(dung.tree, indexMoi, dung.person.id),
    validateAll(dung.tree, indexMoi, 'union',  { unionId: dung.union.id })
  );
  if (laChaMe) {
    raSoat = gopRaSoat(raSoat, validateAll(dung.tree, indexMoi, 'child',
      { childId: noiVao.childId, parentId: dung.person.id }));
  }

  if (!raSoat.canSave) {
    hienNhan('Chưa thêm được — có chỗ không thể đúng được:', true,
             raSoat.errors.map((m) => m.message));
    return;
  }

  const canhBao = loiNhacCuaForm().concat(raSoat.warnings.map((m) => m.message));

  // Cặp vừa dựng TRÙNG với một cặp một người đã có — người dùng phải có đường
  // thứ ba, không chỉ "Vẫn thêm" hoặc "Huỷ". Lý do đầy đủ ở `veNutNoiVaoCapCu`.
  // Luật 13: bỏ những cặp mà bảng *Con sẵn có* trong form ĐÃ hỏi rồi. Người
  // dùng vừa cố ý không tích chúng — bày lại đúng câu ấy trong khối cảnh báo là
  // tự mâu thuẫn, và tệ hơn: nó dạy người ta rằng câu trả lời trong form không
  // được tính. Còn lại đúng phần bảng kia không kể tới: cặp một người CHƯA CÓ
  // CON, nơi không có hệ quả nào để bày thành ô tích.
  const capTrung = (!laChaMe && dung.laUnionMoi)
    ? capTrungNoiVaoDuoc(dung.tree, dung.union.id)
    : [];
  const capCu    = capTrung.filter((u) => !capDaHoiOForm(u.id));
  const capDaHoi = capTrung.filter((u) => capDaHoiOForm(u.id));

  if (canhBao.length > 0 && !N.daXemCanhBao) {
    N.daXemCanhBao = true;
    N.nutLuu.textContent = 'Vẫn thêm';
    hienNhan(capCu.length > 0
      ? 'Có chỗ đáng xem lại — và ở đây bạn có hai đường đi, không chỉ một:'
      : 'Có chỗ đáng xem lại. Gia phả cũ có những chuyện thật mà nghe như ' +
        'lỗi, nên app không chặn — bấm "Vẫn thêm" nếu bạn biết là đúng:',
      false, canhBao);
    veNutNoiVaoCapCu(dung.tree, capCu, dung.person);
    veLoiDaHoiOForm(capDaHoi);
    return;
  }

  N.dangLuu = true;
  N.nutLuu.disabled = true;
  N.nutLuu.style.opacity = '.45';
  hienNhan('Đang lưu…', false);

  const nguoiMoi = dung.person;
  // b124a — người ĐÃ CÓ ở cây khác: lấy tên thật từ dòng gợi ý đã chọn.
  const tenMoi   = nguoiCoSanChon ? nguoiCoSanChon.ten
    : (coGiaTri(fullName(nguoiMoi)) ? fullName(nguoiMoi) : nguoiMoi.id);
  const vai      = laChaMe
    ? (noiVao.gioi === 'F' ? 'mẹ' : (noiVao.gioi === 'M' ? 'cha' : 'cha/mẹ'))
    : 'vợ/chồng';
  const moc      = laChaMe ? noiVao.childId : noiVao.banDoiId;

  // b124a — `ghiBanGhi(null, …)` là đúng đường có sẵn: KHÔNG ghi bản ghi
  // người, chỉ ghi quan hệ. Mọi nơi khác trong file đã gọi theo cách này khi
  // người kia là người có sẵn TRONG CÙNG CÂY (`dungCayNoi`); ở đây khác đúng
  // một chỗ — người có sẵn ấy đang thuộc CÂY KHÁC.
  const ketQua = await ghiBanGhi(nguoiCoSanChon ? null : nguoiMoi, [dung.union], {
    action: 'create',
    target: nguoiMoi.id,
    note:   'Thêm ' + vai + ' ' + tenMoi + ' cho ' + tenNguoi(moc) +
            ' vào ' + dung.union.id +
            (dung.laUnionMoi ? ' (cặp mới, tạo cùng lúc)' : '') +
            (nguoiCoSanChon ? ' — người ĐÃ CÓ ở cây khác, kéo vào (b124a).' : '.'),
    diff:   dung.diff,
  });

  N.dangLuu = false;
  if (!N.lopPhu) return;   // người dùng đã đóng form trong lúc chờ máy chủ

  if (ketQua && ketQua.ok) {
    closePersonForm();
    if (N.xuLyNgoai.onDaLuu) N.xuLyNgoai.onDaLuu(nguoiMoi.id);
    return;
  }

  N.nutLuu.disabled = false;
  N.nutLuu.style.opacity = '1';
  hienLoiGhi(ketQua, 'Người này CHƯA được thêm.');
}

/**
 * Cây mới cho `themChaMe`, bằng các hàm thuần nối đuôi nhau.
 *
 * ⚠ THỨ TỰ BẮT BUỘC, và lý do y hệt `dungCayThemChaMe`'s họ hàng ở
 * `dungCayThemCon`: `nextId()` đọc cây, nên mỗi hàm phải nhận CÂY TRẢ VỀ của
 * hàm trước. Chạy hai hàm tạo trên cùng một cây cũ là sinh hai bản ghi trùng mã.
 *
 * @returns {{tree, person, union, laUnionMoi, diff}|null}
 */
function dungCayThemChaMe(cay, thayDoi, quanHe, ghiNhan) {
  if (!cay || !noiVao || !noiVao.childId) return null;

  const kqP = taoHoacDungNguoi(cay, thayDoi, ghiNhan);
  if (!kqP) return null;

  let tree = kqP.tree;
  const diff = Object.assign({}, kqP.diff);

  // Cặp có sẵn: người mới đứng vào chỗ trống trong hàng vợ/chồng. Quan hệ của
  // người con với cặp ấy đã ghi từ trước, không đụng tới.
  if (noiVao.unionId) {
    const kqA = addPartner(tree, noiVao.unionId, kqP.person.id);
    if (!kqA) return null;
    Object.assign(diff, kqA.diff);
    return { tree: kqA.tree, person: kqP.person, union: kqA.union,
             laUnionMoi: false, diff };
  }

  // Cặp mới: tạo cặp một người rồi treo người con vào. Hai việc, một lần lưu —
  // luật 4. Lưu nửa chừng là để lại một cặp vô hình (`conLyDoTonTai` là sai).
  const kqU = createUnion(tree, [kqP.person.id], {});
  if (!kqU) return null;
  tree = kqU.tree;
  Object.assign(diff, kqU.diff);

  const kqC = addChild(tree, kqU.union.id, noiVao.childId, quanHe);
  if (!kqC) return null;
  Object.assign(diff, kqC.diff);

  return { tree: kqC.tree, person: kqP.person, union: kqC.union,
           laUnionMoi: true, diff };
}

/**
 * Cây mới cho `themBanDoi`. @returns {{tree, person, union, laUnionMoi, diff}|null}
 *
 * ⚠ Từ bước 65 hàm này còn mang theo BA thứ nữa mà form vừa hỏi: trạng thái
 * cặp, ngày và nơi kết hôn (`docKhoiHonNhan`), và quan hệ đẻ/nuôi của những
 * người con được tích (`apQuanHeConDaChon`). Cả ba đi trong ĐÚNG MỘT lần
 * `luuCay()` cùng người mới — luật 4.
 */
function dungCayThemBanDoi(cay, thayDoi, ghiNhan) {
  if (!cay || !noiVao || !noiVao.banDoiId) return null;

  const kqP = taoHoacDungNguoi(cay, thayDoi, ghiNhan);
  if (!kqP) return null;

  const tree = kqP.tree;
  const diff = Object.assign({}, kqP.diff);
  const hon  = docKhoiHonNhan();

  // Nối vào một cặp ĐÃ CÓ. Hai cửa dẫn vào đây, và từ bước 65 cửa thứ hai mới
  // là cửa chính: bảng *Con sẵn có* trong form (`datChoNoiBanDoi`), và nút
  // *"Nối vào cặp sẵn có"* của khối cảnh báo (bước 63, `veNutNoiVaoCapCu`).
  if (noiVao.unionId) {
    const kqA = addPartner(tree, noiVao.unionId, kqP.person.id);
    if (!kqA) return null;
    Object.assign(diff, kqA.diff);

    // `addPartner` cố ý không nhận `ranks` — nó làm đúng một việc. Thứ bậc và
    // ba ô hôn nhân ghi bằng một hàm nữa NỐI ĐUÔI ngay sau, y hệt `dungCayNoi`
    // nhánh vợ/chồng có sẵn cặp. Câu trả lời của người dùng nói về CHỖ ĐỨNG của
    // cặp này trong đời người kia, nên nó vẫn đúng khi cặp ấy là cặp cũ.
    const sua = Object.assign({}, hon);
    const bac = docThuBacNhap();
    if (Object.keys(bac).length > 0) sua.ranks = bac;

    const kqR = updateUnion(kqA.tree, noiVao.unionId, sua);
    if (!kqR) return null;
    Object.assign(diff, kqR.diff);

    const kqC = apQuanHeConDaChon(kqR.tree, noiVao.unionId, diff);
    if (!kqC) return null;

    // Đọc lại bản ghi cặp TỪ CÂY CUỐI CÙNG, không dùng `kqR.union`: mấy lời gọi
    // `updateChildRelation` ở trên đã sinh ra một bản mới, và trả về bản cũ là
    // đưa cho `luuCay()` một cặp thiếu đúng cái vừa sửa.
    const uCuoi = kqC.tree.unions.find((x) => x && x.id === noiVao.unionId);
    if (!uCuoi) return null;

    return { tree: kqC.tree, person: kqP.person, union: uCuoi,
             laUnionMoi: false, diff };
  }

  // Thứ bậc do người dùng trả lời, không do app đoán (luật 12). Ô chỉ mọc ra
  // khi `noiVao.banDoiId` đã có cặp khác, nên ca thường gặp — lấy vợ/chồng lần
  // đầu — vẫn đi qua đây với một bảng rỗng, đúng như trước.
  const kqU = createUnion(tree, [noiVao.banDoiId, kqP.person.id],
                          Object.assign({ ranks: docThuBacNhap() }, hon));
  if (!kqU) return null;
  Object.assign(diff, kqU.diff);

  return { tree: kqU.tree, person: kqP.person, union: kqU.union,
           laUnionMoi: true, diff };
}

/**
 * Những cặp ĐÃ CÓ mà người vừa thêm có thể bước vào, thay vì để lại một cặp
 * thứ hai trùng với chúng.
 *
 * Dò bằng `timCapTrung` trên CÂY ĐANG DỰNG — cùng nguồn với lời cảnh báo mà
 * người dùng đang đọc, nên hai thứ không thể lệch nhau. Đọc mã cặp ra khỏi câu
 * tiếng Việt của cảnh báo thì hỏng ngay lần đầu ai đó sửa câu ấy cho hay hơn
 * (`review.js` đã học bài này rồi).
 *
 * Chỉ nhận cặp còn CHỖ TRỐNG trong hàng vợ/chồng — `addPartner` không nhét
 * được người thứ ba, và trong gia phả này nhiều vợ/nhiều chồng là NHIỀU CẶP.
 * Người vừa thêm là người MỚI nên không thể đã đứng sẵn trong cặp cũ; mọi cặp
 * trùng tìm được ở đây đều là cặp một người.
 *
 * @returns {object[]} bản ghi cặp, đọc từ `cay` chứ không từ `state.index`
 */
function capTrungNoiVaoDuoc(cay, unionMoiId) {
  const dsU = (cay && Array.isArray(cay.unions)) ? cay.unions : [];
  const ra = [];

  for (const x of timCapTrung(cay)) {
    if (x.unionA !== unionMoiId && x.unionB !== unionMoiId) continue;
    const banId = (x.unionA === unionMoiId) ? x.unionB : x.unionA;
    const u = dsU.find((y) => y && y.id === banId);
    if (u && !u.deleted && soPartner(u) < 2) ra.push(u);
  }
  return ra;
}

/**
 * Đường thứ ba của hộp cảnh báo trùng: **nối vào cặp sẵn có**, không dựng thêm
 * cặp thứ hai (chủ dự án chốt 27/08/2026).
 *
 * --- Vì sao câu hỏi này ở ĐÂY chứ không hỏi trước khi mở form ---------------
 *
 * Ngày 20/08 chủ dự án đã bỏ câu hỏi *"nối vào cặp nào"* khỏi đường thêm
 * vợ/chồng mới, vì lối duy nhất nó mở ra là *"cho người mới vào cặp một người
 * ĐANG CÓ CON"* — mà làm thế là lặng lẽ khẳng định người mới là cha/mẹ của mấy
 * người con ấy, đúng thứ luật 9 cấm. Quyết định ấy vẫn đứng: app **không hỏi
 * trước**.
 *
 * Nhưng cái giá của nó đo được ngày 27/08, bằng một ca thật: thêm con f cho e
 * (app dựng cặp một người `U0039`), rồi thêm vợ g cho e (app dựng `U0040`),
 * rồi vào sửa gia đình của f để thêm mẹ g — g bước vào `U0039`, và `U0040` ở
 * lại làm một **nét ngang thừa** giữa e và g trên sơ đồ. Lúc cảnh báo trùng
 * hiện ra, người dùng chỉ có "Vẫn thêm" hoặc "Huỷ": không đường nào dọn được
 * cái sắp sinh ra.
 *
 * Nút này thêm đường thứ ba, và **không lặng lẽ** — nó kể thẳng tên từng người
 * con mà người mới sắp thành cha/mẹ. Đó là điều luật 9 đòi: một việc kéo theo
 * một việc khác thì phải nói ra, chứ không phải là không được làm.
 *
 * ⚠ Bấm nút là mở lại vòng rà từ đầu (`daXemCanhBao` về `false`) trên đường đi
 * MỚI. Cặp cũ có thể có cảnh báo riêng của nó — chênh tuổi cha mẹ chẳng hạn —
 * và người dùng phải được đọc những cảnh báo ấy, không thể thừa hưởng cú bấm
 * "đã xem" của đường cũ.
 */
function veNutNoiVaoCapCu(cay, cacCap, nguoiMoi) {
  if (!N.khoiKetQua || !cacCap || cacCap.length === 0) return;

  const vai = nguoiMoi.sex === 'F' ? 'mẹ'
            : (nguoiMoi.sex === 'M' ? 'cha' : 'cha / mẹ');
  const tenMoi = tenTrongCay(cay, nguoiMoi.id);

  for (const u of cacCap) {
    const hang = document.createElement('div');
    hang.style.cssText = 'margin-top:10px';
    hang.append(nutChon('Nối vào cặp ' + u.id + ' sẵn có', false, () => {
      // `datChoNoiBanDoi` chứ không gán thẳng `noiVao.unionId`: nó vẽ lại ô thứ
      // bậc và khối *Cuộc hôn nhân này* theo đúng cặp sắp bước vào. Gán thẳng
      // thì ba ô hôn nhân còn đang rỗng của một cặp MỚI, và `updateUnion` sẽ
      // ghi chúng đè lên ngày cưới đang lưu của cặp cũ — mất dữ liệu, không
      // một lời báo (luật 13).
      datChoNoiBanDoi(u.id);
      handleAddNguoiThan();
    }));
    N.khoiKetQua.append(hang);

    const con = (Array.isArray(u.children) ? u.children : [])
      .map((c) => tenTrongCay(cay, c && c.personId));

    const phu = document.createElement('div');
    phu.textContent = con.length > 0
      ? tenMoi + ' sẽ thành ' + vai + ' của ' + con.join(', ') + '.'
      : 'Hai người vẫn là một cặp — app không dựng thêm cặp thứ hai.';
    // ĐẬM hơn dòng chỉ dẫn ở cuối, cố ý: đây là câu nói ra HỆ QUẢ của cú bấm,
    // câu duy nhất trong khối này mà đọc sót là gán nhầm cha/mẹ cho một người.
    phu.style.cssText =
      'margin-top:5px;padding:0 3px;font-size:11px;line-height:1.5;color:var(--sd-chu-vua,#5c554e)';
    N.khoiKetQua.append(phu);
  }

  const cuoi = document.createElement('div');
  cuoi.textContent = 'Còn nếu đây thật sự là một cuộc hôn nhân KHÁC, bấm "Vẫn ' +
                     'thêm" ở dưới để giữ cặp mới.';
  cuoi.style.cssText =
    'margin-top:10px;padding:0 3px;font-size:11px;line-height:1.5;color:var(--sd-chu-phu,#8a8078)';
  N.khoiKetQua.append(cuoi);
}

// ============================================================
// KẾT NỐI hai người ĐÃ CÓ SẴN
// ============================================================


/**
 * Nối `targetId` vào `personId` theo một quan hệ.
 *
 * @param {string} personId    người đang mở thẻ — mọi câu chữ nói từ phía họ
 * @param {string} targetId    người vừa được chọn ở màn hình Danh sách người
 * @param {'parent'|'spouse'|'child'|''} relationType  rỗng = hỏi người dùng
 * @param {{onDaLuu?:function(string)}} [xuLy]
 *
 * ⚠ Chỗ CHỌN NGƯỜI không nằm trong file này. `pages/person-list.js` cũng thuộc
 * lớp `pages`, và hai file `pages` không import lẫn nhau (chốt 17/08/2026) —
 * nên `tree-view.js` mở danh sách, đóng nó lại, rồi mới gọi hàm này với mã
 * người đã chọn xong. Cách ấy còn tránh được hai lớp phủ chồng nhau.
 */
export function linkExisting(personId, targetId, relationType, xuLy = {}) {
  const index = state.index;
  if (!index) return;

  const a = index.personById.get(personId);
  const b = index.personById.get(targetId);
  if (!a || !b) {
    moHopBao('Kết nối', 'Không tìm thấy một trong hai người. Tải lại trang rồi thử lại.', true);
    return;
  }
  if (personId === targetId) {
    moHopBao('Kết nối', 'Không nối một người với chính họ được. Chọn một người khác.', true);
    return;
  }

  if (!TEN_QUAN_HE[relationType]) {
    hoiQuanHeNoi(personId, targetId, xuLy);
    return;
  }

  // Nối lại thứ đã nối rồi thì nói ngay, đừng để người dùng đi hết ba bước rồi
  // mới nghe "không làm được".
  const daNoi = quanHeDaCo(personId, targetId);
  if (daNoi) {
    moHopBao('Kết nối',
      tenNguoi(targetId) + ' đã là ' + daNoi + ' của ' + tenNguoi(personId) +
      ' trong gia phả rồi.', false,
      ['Muốn bỏ mối nối ấy thì dùng "Gỡ nối" trong menu, không phải "Kết nối".']);
    return;
  }

  const vaiTro = relationType === 'parent' ? 'chaMe'
               : (relationType === 'spouse' ? 'banDoi' : 'con');

  chonCap(vaiTro, personId, xuLy, (unionId) => {
    moHopXacNhanNoi({ personId, targetId, loai: relationType, unionId }, xuLy);
  }, targetId);
}

/** Ba nút, ba câu nói từ phía người đang mở thẻ. Không dùng chữ "quan hệ 1". */
function hoiQuanHeNoi(personId, targetId, xuLy) {
  const A = tenNguoi(personId);
  const B = tenNguoi(targetId);

  moHopChon('chon', xuLy, {
    tieuDe: 'Kết nối',
    phu:    A + '  ·  ' + personId + '   ←→   ' + B + '  ·  ' + targetId,
    cauMo:  'Hai người này là gì của nhau?',
    cacMuc: [
      { ma: 'parent', chu: B + ' là CHA / MẸ của ' + A,
        phu: 'B sẽ đứng vào một cặp cha mẹ của A.',
        chay: () => linkExisting(personId, targetId, 'parent', xuLy) },
      { ma: 'spouse', chu: B + ' là VỢ / CHỒNG của ' + A,
        phu: 'Hai người thành một cặp.',
        chay: () => linkExisting(personId, targetId, 'spouse', xuLy) },
      { ma: 'child', chu: B + ' là CON của ' + A,
        phu: 'B thành người con của một cặp của A.',
        chay: () => linkExisting(personId, targetId, 'child', xuLy) },
    ],
  });
}

/**
 * Quan hệ đã có sẵn giữa hai người, hoặc chuỗi rỗng.
 * Đọc đúng MỘT bước từ `personId` — không phải phép duyệt đồ thị, không cần
 * `visited`.
 */
function quanHeDaCo(personId, targetId) {
  const index = state.index;
  for (const m of getSpouses(index, personId))  if (m.personId === targetId) return 'vợ/chồng';
  for (const m of getChildren(index, personId)) if (m.personId === targetId) return 'con';
  for (const u of getParentUnions(index, personId)) {
    if ((Array.isArray(u.partners) ? u.partners : []).indexOf(targetId) >= 0) return 'cha/mẹ';
  }
  return '';
}

/**
 * Hộp xác nhận của đường NỐI. Có ô "con nuôi" khi mối nối ấy là cha mẹ – con.
 *
 * ⚠ `noiCtx` phải đặt SAU `moHopTrang()`, không được đặt trước. `moHopTrang` mở
 * đầu bằng `closePersonForm()`, mà hàm ấy dọn sạch MỌI ngữ cảnh của file này —
 * kể cả `noiCtx`. Bản đầu đặt trước và hộp ngã ngay lần mở thứ nhất; bài kiểm
 * hành vi bắt được, còn Node thì không, vì lỗi nằm trọn trong lớp `pages`.
 */
function moHopXacNhanNoi(ctx, xuLy) {
  const chan = moHopTrang('noi', xuLy, 'Kết nối',
                          tenNguoi(ctx.personId) + '  ←→  ' + tenNguoi(ctx.targetId));
  noiCtx = ctx;
  const { personId, targetId, loai, unionId } = ctx;

  const canTro = canTroLuu();
  if (canTro) {
    hienNhan(canTro, true);
    chan.append(nutChanXoa('Đóng', false, () => closePersonForm()));
    return;
  }

  hienNhan('Nối xong thì:', false, cauKeNoi());

  // Ô "con nuôi" chỉ mọc khi mối nối SẮP TẠO RA là quan hệ cha mẹ – con mới.
  // Nối thêm một người vào cặp cha mẹ đã có thì quan hệ đẻ/nuôi của người con
  // với cặp ấy đã ghi từ trước — hỏi lại là mời đổi một thứ không ai định đụng.
  const hoiNuoi = (loai === 'child') || (loai === 'parent' && !unionId);
  if (hoiNuoi) {
    N.khoiKetQua.append(veNhan(loai === 'child'
      ? 'Quan hệ của người con với cặp này'
      : 'Quan hệ của cha / mẹ này với ' + tenNguoi(personId)));
    N.khoiKetQua.append(oQuanHeMoi(loai === 'child'
      ? 'Quan hệ của người con với cặp này'
      : 'Quan hệ của cha / mẹ này với ' + tenNguoi(personId), loai === 'child' ? 'con' : 'chaMe'));
  } else {
    o.quanHe = null;
  }

  // Luật 12 — chỉ đường VỢ/CHỒNG mới sinh ra một cuộc hôn nhân. Hai vai kia nối
  // quan hệ cha mẹ – con, thứ không có thứ bậc vợ cả vợ thứ nào.
  //
  // Cặp có sẵn: chỉ người BƯỚC VÀO mới có thứ bậc mới — người đang đứng trong
  // đó đã có con số của mình từ trước, hỏi lại là mời họ đổi một thứ không ai
  // định đụng. Cặp mới: hỏi cả hai phía, và `khoiHoiThuBac` tự im với người
  // chưa có cặp nào.
  if (loai === 'spouse') {
    const ds = unionId
      ? [aiVaoCap(unionId, personId, targetId)]
      : [personId, targetId];
    for (const id of ds) gaiTruocChan(chan, khoiHoiThuBac(id, unionId));
  }

  N.nutLuu = nutChanXoa('Nối hai người này', false, () => chayNoi());
  chan.append(N.nutLuu, nutChanXoa('Không nối', false, () => closePersonForm()));
}

/**
 * Ai là người BƯỚC VÀO cặp `unionId` — người chưa đứng sẵn trong đó.
 * Cần vì `chonCap('banDoi')` nay kể cả cặp của người kia (vá 22/08/2026).
 */
function aiVaoCap(unionId, personId, targetId) {
  const u = state.index && state.index.unionById.get(unionId);
  const cac = (u && Array.isArray(u.partners)) ? u.partners : [];
  return cac.indexOf(targetId) >= 0 ? personId : targetId;
}

/**
 * ⚠ Người con này ĐÃ CÓ cha mẹ ở cặp khác — dòng cảnh báo, hoặc chuỗi rỗng.
 *
 * Lỗ hổng thứ hai của đường kết nối (đo được 21/08/2026): từ thẻ VỢ chọn
 * *"C là CON của tôi"*, app nối C vào cặp mới **mà không nói C đã có cha mẹ ở
 * cặp khác** — kết quả là hai cặp cha mẹ chung một người cha, đúng loại dữ liệu
 * bẩn mà màn Rà soát phải đi nhặt về sau.
 *
 * Chỉ NÓI RA, không chặn: hai cặp cha mẹ là chuyện thật khi có cha mẹ nuôi hoặc
 * cha mẹ kế. Thứ sai là làm việc ấy mà người dùng không biết mình đang làm.
 */
function loiConDaCoChaMe(childId, unionId) {
  const index = state.index;
  if (!index || !childId) return '';
  const khac = getParentUnions(index, childId).filter((u) => u.id !== unionId);
  if (khac.length === 0) return '';

  return '⚠ ' + tenNguoi(childId) + ' ĐÃ CÓ cha mẹ trong gia phả: ' +
         khac.map((u) => keTenPartner(u.id) + '  ·  ' + u.id).join('   |   ') +
         '. Nối xong thì người này có ' + (khac.length + 1) + ' cặp cha mẹ — ' +
         'đúng khi đó là cha mẹ NUÔI hoặc cha mẹ KẾ, còn nếu chỉ là một cặp ghi ' +
         'trùng thì hãy "Không nối", gỡ cặp cũ trước rồi nối lại.';
}

/** Từng dòng hậu quả của đường NỐI. Nối chỉ THÊM cạnh, nên không ai mất gì. */
function cauKeNoi() {
  const { personId, targetId, loai, unionId } = noiCtx;
  const A = tenNguoi(personId);
  const B = tenNguoi(targetId);
  const dong = [];

  if (loai === 'spouse') {
    const vao = unionId ? aiVaoCap(unionId, personId, targetId) : targetId;
    dong.push(A + ' và ' + B + ' thành vợ chồng' +
              (unionId ? ' trong cặp ' + unionId + ' — ' + tenNguoi(vao) +
                         ' là người bước vào cặp đang có.'
                       : ' trong một cặp mới.'));
    if (unionId) {
      const u = state.index.unionById.get(unionId);
      const cacCon = (Array.isArray(u && u.children) ? u.children : [])
        .map((c) => c && c.personId).filter((id) => id && state.index.personById.has(id));
      if (cacCon.length > 0) {
        dong.push('⚠ Cặp ' + unionId + ' đang có ' + cacCon.length + ' người con (' +
                  cacCon.map(tenNguoi).join(' · ') + '), nên ' + tenNguoi(vao) +
                  ' đồng thời thành cha/mẹ của họ. Trong gia phả này quan hệ cha ' +
                  'mẹ – con đi QUA cặp, không nối thẳng người với người.');
      }
    }
  } else if (loai === 'child') {
    dong.push(B + ' thành người con của ' +
              (unionId ? keTenPartner(unionId) + '  ·  ' + unionId
                       : A + ' (app tạo thêm một cặp mới cho riêng họ)') + '.');
    const canhBao = loiConDaCoChaMe(targetId, unionId);
    if (canhBao) dong.push(canhBao);
  } else {
    dong.push(B + ' thành cha / mẹ của ' + A +
              (unionId ? ', đứng chung cặp ' + unionId + ' với ' + keTenPartner(unionId) + '.'
                       : ' trong một cặp cha mẹ mới.'));
    const canhBao = loiConDaCoChaMe(personId, unionId);
    if (canhBao) dong.push(canhBao);
  }

  dong.push('Không ai bị xoá, và không mối nối nào đang có bị bỏ đi. Nối nhầm ' +
            'thì mở lại menu và dùng "Gỡ nối".');
  return dong;
}

/**
 * Dựng cây cho đường NỐI, rồi rà và ghi.
 *
 * Cây được dựng LẠI ở đây chứ không dựng sẵn lúc mở hộp — khác luật 8 của đường
 * xoá, và cố ý: ô "con nuôi" đổi được sau khi hộp đã mở, nên cây dựng lúc mở là
 * cây của một lựa chọn có thể đã cũ. Luật 1 vẫn đứng nguyên: thứ được rà ngay
 * dưới đây đúng là thứ được ghi ở cuối hàm.
 */
async function chayNoi() {
  if (N.dangLuu || !noiCtx) return;

  const quanHe = docQuanHeMoi();
  const dung = dungCayNoi(quanHe);
  if (!dung) {
    hienNhan('Không nối được hai người này. Có thể gia phả vừa thay đổi trong lúc ' +
             'hộp đang mở. Tải lại trang rồi thử lại.', true);
    return;
  }

  const { personId, targetId, loai } = noiCtx;
  const indexMoi = buildIndex(dung.tree);

  let raSoat = validateAll(dung.tree, indexMoi, 'union', { unionId: dung.union.id });
  if (loai === 'child') {
    raSoat = gopRaSoat(raSoat, validateAll(dung.tree, indexMoi, 'child',
      { childId: targetId, unionId: dung.union.id }));
  } else if (loai === 'parent') {
    raSoat = gopRaSoat(raSoat, validateAll(dung.tree, indexMoi, 'child',
      { childId: personId, parentId: targetId }));
  }

  if (!raSoat.canSave) {
    hienNhan('Chưa nối được — có chỗ không thể đúng được:', true,
             raSoat.errors.map((m) => m.message));
    return;
  }

  const canhBao = loiThuBacGoSai().concat(raSoat.warnings.map((m) => m.message));
  if (canhBao.length > 0 && !N.daXemCanhBao) {
    N.daXemCanhBao = true;
    N.nutLuu.textContent = 'Vẫn nối';
    hienNhan('Có chỗ đáng xem lại. Gia phả cũ có những chuyện thật mà nghe như ' +
             'lỗi, nên app không chặn — bấm "Vẫn nối" nếu bạn biết là đúng:',
             false, canhBao);
    return;
  }

  N.dangLuu = true;
  N.nutLuu.disabled = true;
  N.nutLuu.style.opacity = '.45';
  hienNhan('Đang nối…', false);

  const ketQua = await ghiBanGhi(null, [dung.union], {
    action: 'update',
    target: dung.union.id,
    note:   'Nối ' + tenNguoi(targetId) + ' làm ' + TEN_QUAN_HE[loai] + ' của ' +
            tenNguoi(personId) + ' qua ' + dung.union.id +
            (dung.laUnionMoi ? ' (cặp mới, tạo cùng lúc)' : '') + '.',
    diff:   dung.diff,
  });

  N.dangLuu = false;
  if (!N.lopPhu) return;

  if (!(ketQua && ketQua.ok)) {
    N.nutLuu.disabled = false;
    N.nutLuu.style.opacity = '1';
    hienLoiGhi(ketQua, 'Hai người này CHƯA được nối.');
    return;
  }

  if (N.xuLyNgoai.onDaLuu) N.xuLyNgoai.onDaLuu(targetId);

  N.nutLuu = null;
  hienNhan('Đã nối ' + tenNguoi(targetId) + ' làm ' + TEN_QUAN_HE[loai] +
           ' của ' + tenNguoi(personId) + '.', false);

  const hang = document.createElement('div');
  hang.style.cssText = 'margin-top:10px';
  hang.append(nutChon('Xong', true, () => closePersonForm()));
  N.khoiKetQua.append(hang);
}

/** @returns {{tree, union, laUnionMoi, diff}|null} */
function dungCayNoi(quanHe) {
  const { personId, targetId, loai, unionId } = noiCtx;
  let tree = state.tree;
  const diff = {};

  if (loai === 'spouse') {
    const bac = docThuBacNhap();   // luật 12; rỗng khi không có ô nào phải hỏi

    if (unionId) {
      // Cặp ấy có thể là cặp của NGƯỜI KIA (`chonCap` nay gom cả hai phía), nên
      // người bước vào là người chưa đứng trong đó — không mặc định là `targetId`.
      const kq = addPartner(tree, unionId, aiVaoCap(unionId, personId, targetId));
      if (!kq) return null;
      Object.assign(diff, kq.diff);

      // `addPartner` cố ý không nhận `ranks`, nên thứ bậc ghi bằng một hàm nữa
      // NỐI ĐUÔI ngay sau — trên cây MỚI, không phải cây cũ. Khoá phải là người
      // đã nằm trong `partners`, mà `updateUnion` chỉ thấy điều đó sau khi
      // `addPartner` chạy xong.
      if (Object.keys(bac).length === 0) {
        return { tree: kq.tree, union: kq.union, laUnionMoi: false, diff };
      }
      const kqR = updateUnion(kq.tree, unionId, { ranks: bac });
      if (!kqR) return null;
      Object.assign(diff, kqR.diff);
      return { tree: kqR.tree, union: kqR.union, laUnionMoi: false, diff };
    }

    const kq = createUnion(tree, [personId, targetId], { ranks: bac });
    if (!kq) return null;
    return { tree: kq.tree, union: kq.union, laUnionMoi: true, diff: kq.diff };
  }

  if (loai === 'child') {
    let uid = unionId;
    let laMoi = false;
    if (!uid) {
      const kqU = createUnion(tree, [personId], {});
      if (!kqU) return null;
      tree = kqU.tree; uid = kqU.union.id; laMoi = true;
      Object.assign(diff, kqU.diff);
    }
    const kqC = addChild(tree, uid, targetId, quanHe);
    if (!kqC) return null;
    Object.assign(diff, kqC.diff);
    return { tree: kqC.tree, union: kqC.union, laUnionMoi: laMoi, diff };
  }

  // 'parent'
  if (unionId) {
    const kq = addPartner(tree, unionId, targetId);
    if (!kq) return null;
    return { tree: kq.tree, union: kq.union, laUnionMoi: false, diff: kq.diff };
  }
  const kqU = createUnion(tree, [targetId], {});
  if (!kqU) return null;
  tree = kqU.tree;
  Object.assign(diff, kqU.diff);
  const kqC = addChild(tree, kqU.union.id, personId, quanHe);
  if (!kqC) return null;
  Object.assign(diff, kqC.diff);
  return { tree: kqC.tree, union: kqC.union, laUnionMoi: true, diff };
}


// ============================================================
// XUẤT LẠI — các màn hình đã dời ra file riêng
// ============================================================
//
// ⚠ `tree-view.js` và nhiều bài kiểm trong `kiem-thu/` nhập thẳng từ
// `pages/person-edit.js`, nên mọi tên đã dời sang file khác phải còn ra được
// từ đúng đường dẫn ấy. Nền dùng chung ở `form-nen.js` từ đợt 7 (b158); chỉ
// `closePersonForm` còn được xuất lại ở đây, vì nơi ngoài nhóm form gọi nó.

export { closePersonForm } from './form-nen.js';
export { khoiPhucNguoi, khoiPhucCap, donThungRac, khoiPhucNhieu,
         chuyenVaoThungRac } from './form-thung-rac.js';
export { openSapThuTu } from './form-sap-thu-tu.js';
export { goNoiNguoi, unlink } from './form-go-noi.js';
export { openSuaCon } from './form-sua-con.js';
export { openFamilyForm } from './form-gia-dinh.js';
export { openUnionForm } from './form-cap.js';
export { openMergeForm } from './form-gop.js';
export { xoaNguoi } from './form-xoa.js';
