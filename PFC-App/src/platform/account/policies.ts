/**
 * Policy pages (SYS-17, mockup 274). DRAFTS written from how the system actually behaves (what is
 * stored, who can see it, how to export / delete). They are not legal advice and must be reviewed by
 * PFC and a legal adviser before launch; the UI shows that banner until POLICY_STATUS is "approved".
 */
export const POLICY_VERSION = "draft-2026-11-20";
export const POLICY_STATUS: "draft" | "approved" = "draft";

export type Policy = { slug: string; title: string; sections: { heading: string; body: string[] }[] };

export const POLICIES: Policy[] = [
  {
    slug: "terms",
    title: "Điều khoản sử dụng",
    sections: [
      {
        heading: "Tài khoản",
        body: [
          "Mỗi người dùng một tài khoản PFC để dùng tất cả các nhánh: Tài chính, Học tập, Dự án, Marketplace, Cơ hội, Câu lạc bộ.",
          "Bạn chịu trách nhiệm giữ bí mật mật khẩu và mã xác thực hai lớp. Hãy báo Chủ nhiệm PFC nếu nghi ngờ tài khoản bị dùng trái phép.",
          "Chủ nhiệm có thể khóa tài khoản vi phạm; tài khoản bị khóa không đăng nhập được ở bất kỳ nhánh nào.",
        ],
      },
      {
        heading: "Vai trò và quyền",
        body: [
          "Quyền thao tác phụ thuộc vai trò (Chủ nhiệm, Ban điều hành, Trưởng ban, Thành viên) và được kiểm tra trên máy chủ. Bảng chi tiết ở mục Thêm → Phân quyền.",
        ],
      },
      {
        heading: "Mua bán trên Marketplace",
        body: [
          "Giao dịch diễn ra trực tiếp giữa người mua và người bán. PFC duyệt người bán và tin đăng nhưng hiện chưa thu tiền hộ.",
          "Người mua chỉ hủy được đơn khi đơn chưa được xác nhận; người bán hủy đơn phải ghi lý do.",
        ],
      },
      {
        heading: "Nội dung bạn đăng",
        body: ["Khóa học, tin đăng, dự án, bài diễn đàn cần tuân theo Quy định về nội dung. Nội dung có thể bị từ chối hoặc ẩn kèm lý do."],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Chính sách quyền riêng tư",
    sections: [
      {
        heading: "Dữ liệu chúng tôi lưu",
        body: [
          "Hồ sơ: họ tên, email, và các thông tin bạn tự điền (số điện thoại, ngày sinh, giới tính, địa chỉ, giới thiệu, ảnh đại diện).",
          "Dữ liệu bạn tạo trong từng nhánh: giao dịch và ngân sách, tiến độ học, đơn hàng, dự án, bài viết.",
          "Thiết bị đăng nhập: loại trình duyệt/hệ điều hành và một phần địa chỉ IP (ví dụ 113.161.x.x), để bạn xem và đăng xuất từ xa.",
        ],
      },
      {
        heading: "Ai xem được",
        body: [
          "Dữ liệu tài chính cá nhân chỉ mình bạn xem được.",
          "Ảnh tải lên được xóa thông tin vị trí (GPS) trước khi lưu.",
          "Bạn chọn có hiện trong tìm kiếm thành viên và có cho tìm thấy qua email hay không (Cài đặt → Quyền riêng tư).",
        ],
      },
      {
        heading: "Quyền của bạn",
        body: [
          "Tải xuống toàn bộ dữ liệu cá nhân trong PFC App dưới dạng tệp JSON.",
          "Tự chỉnh sửa thông tin cá nhân bất kỳ lúc nào.",
          "Xóa tài khoản: dữ liệu cá nhân bị xóa; các bản ghi người khác cần (đơn hàng đã hoàn tất, đánh giá, bài diễn đàn) được giữ lại dưới tên “Tài khoản đã xóa”.",
        ],
      },
      {
        heading: "Bảo mật",
        body: [
          "Mật khẩu được băm (bcrypt), khóa xác thực hai lớp được mã hóa, liên kết đặt lại mật khẩu chỉ dùng một lần.",
          "Đăng nhập sai nhiều lần sẽ bị tạm khóa 15 phút.",
        ],
      },
    ],
  },
  {
    slug: "community",
    title: "Chính sách cộng đồng",
    sections: [
      {
        heading: "Tôn trọng",
        body: ["Không quấy rối, phân biệt đối xử, hay chia sẻ thông tin cá nhân của người khác khi chưa được đồng ý."],
      },
      {
        heading: "Kiểm duyệt",
        body: ["Trưởng ban, Ban điều hành và Chủ nhiệm có thể ẩn bài viết hoặc khóa chủ đề vi phạm. Thành viên không xóa hay loại được người khác."],
      },
    ],
  },
  {
    slug: "content",
    title: "Quy định về nội dung",
    sections: [
      {
        heading: "Duyệt trước khi công khai",
        body: [
          "Khóa học, tin đăng bán và dự án được duyệt trước khi hiện công khai. Bị từ chối luôn có lý do để bạn chỉnh sửa và gửi lại.",
          "Liên kết phải là https. Ảnh chỉ nhận JPG, PNG, WebP, tối đa 8 MB.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Chính sách cookie",
    sections: [
      {
        heading: "Cookie cần thiết",
        body: [
          "pfc_session: giữ trạng thái đăng nhập (httpOnly, không đọc được bằng JavaScript).",
          "Cookie phiên của Câu lạc bộ / Cơ hội: chỉ để đăng nhập một lần vào các nhánh.",
          "Cookie tạm khi đăng nhập Google/Facebook hoặc xác thực hai lớp: tự hết hạn sau 5–10 phút.",
        ],
      },
      {
        heading: "Không dùng cookie quảng cáo",
        body: ["PFC App hiện không dùng cookie theo dõi hay quảng cáo của bên thứ ba."],
      },
    ],
  },
  {
    slug: "licenses",
    title: "Giấy phép nguồn mở",
    sections: [
      {
        heading: "Thư viện sử dụng",
        body: [
          "Next.js, React, React DOM, @libsql/client, zod, qrcode, server-only — MIT",
          "lucide-react — ISC",
          "bcryptjs — BSD-3-Clause",
          "sharp, @vercel/blob — Apache-2.0",
        ],
      },
    ],
  },
];

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug) ?? null;
