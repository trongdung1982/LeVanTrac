-- ============================================================
-- giapha-supabase · luoc-do/69-nguoi-dau-tien-co-san.sql
-- Vai trò  : NGƯỜI ĐẦU TIÊN của gia phả mới lấy từ người ĐÃ CÓ ở cây khác.
--            Trước file này: `luu_cay()` ghi gốc cây mà KHÔNG đưa người ấy vào
--            `tree_persons` — trả `ok`, cây vẫn 0 người, gốc trỏ vào khoảng không.
-- Chạy ở   : Supabase → SQL Editor. Dán SAU `52`. Dán lại nhiều lần được.
-- Cần có   : `32` (bản đứng cuối `luu_cay()`) + `52` (vá `contact`).
--            ⚠ VÁ TẠI CHỖ `luu_cay()` — dán lại `32` hay `52` thì PHẢI dán
--            lại file này, không thì lỗi cũ quay lại, IM LẶNG.
-- Sổ tay   : so-tay/luu-du-lieu.md mục *KÉO người cây khác*
-- Đo       : ../kiem-thu/ban-thu-sql/do-nguoi-dau-tien.mjs
-- Phiên bản: 0.1.0 · Cập nhật: 09/10/2026
-- ============================================================
--
-- Vì sao hỏng: `v_keo_vao` chỉ nhận người có bản ghi gửi kèm, hoặc nằm trong
-- quan hệ MỚI KHAI (b128a). Người đầu tiên của cây rỗng không có quan hệ nào,
-- và trình duyệt cố ý không gửi bản ghi của họ (gửi là ghi đè bản cây kia).
-- Lần lưu ấy chỉ mang `tree.root_person_id` — không nhánh nào với tới.
--
-- Luật thêm — một nhánh trong `v_keo_vao`: cây đang có 0 người thì người
-- được đặt làm gốc cũng là người kéo vào. Mọi điều kiện cũ của `v_keo_vao`
-- vẫn gác nguyên: có bản ghi · chưa thuộc cây · người gọi XEM ĐƯỢC một cây
-- đang chứa họ. Cây đã có người thì nhánh này im — đổi gốc không kéo ai vào.

begin;

do $$
declare
  v_def  text;
  v_so   integer;
  v_neo  text := 'select distinct x.ma from (';
  v_thay text := 'select distinct x.ma from (' || chr(10) ||
    '      -- 69: cây rỗng thì người đặt làm gốc cũng là người kéo vào' || chr(10) ||
    '      select p_ops->''tree''->>''root_person_id'' as ma' || chr(10) ||
    '       where cardinality(v_cay_nguoi) = 0' || chr(10) ||
    '      union all';
begin
  v_def := pg_get_functiondef('public.luu_cay(uuid, integer, jsonb, jsonb)'::regprocedure);
  if v_def like '%cardinality(v_cay_nguoi) = 0%' then
    return;   -- đã vá
  end if;
  if v_def not like '%contact%' then
    raise exception 'DỪNG: luu_cay() chưa có vá contact của 52 — dán 52 trước.';
  end if;
  v_so := (length(v_def) - length(replace(v_def, v_neo, ''))) / length(v_neo);
  if v_so <> 1 then
    raise exception 'DỪNG: chỗ neo của luu_cay() khớp % lần (phải đúng 1) — bản đứng cuối đã đổi, sửa luoc-do/69.', v_so;
  end if;
  execute replace(v_def, v_neo, v_thay);
end $$;

commit;

-- ============================================================
-- TỰ KIỂM — mọi dòng phải ĐẠT
-- ============================================================
select 1 as stt, 'luu_cay() đã vá người đầu tiên (69)' as ten_kiem,
  case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'luu_cay'
                and p.prosrc like '%cardinality(v_cay_nguoi) = 0%') = 1
       then 'ĐẠT' else 'HỎNG' end as ket_qua
union all
select 2, 'luu_cay() vẫn giữ rào thép · kéo người · contact',
  case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'luu_cay'
                and p.prosrc like '%ngoairao%'
                and p.prosrc like '%v_pham_vi := v_pham_vi || v_keo_vao%'
                and p.prosrc like '%contact%') = 1
       then 'ĐẠT' else 'HỎNG' end
union all
select 3, 'anon KHÔNG gọi được luu_cay()',
  case when not has_function_privilege('anon',
         'public.luu_cay(uuid, integer, jsonb, jsonb)', 'execute') then 'ĐẠT' else 'HỎNG' end
union all
select 4, 'authenticated gọi được luu_cay()',
  case when has_function_privilege('authenticated',
         'public.luu_cay(uuid, integer, jsonb, jsonb)', 'execute') then 'ĐẠT' else 'HỎNG' end
order by stt;
