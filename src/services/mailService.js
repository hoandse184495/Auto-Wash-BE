import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendRegisterCode = async (email, code) => {
  const info = await transporter.sendMail({
    from: `"Auto Wash Pro" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Mã xác minh đăng ký Auto Wash Pro",
    html: `
      <h2>Mã xác minh đăng ký</h2>
      <p>Mã của bạn là:</p>
      <h1 style="letter-spacing: 4px;">${code}</h1>
      <p>Mã này có hiệu lực trong 5 phút.</p>
    `,
  });

  console.log("[mail] register code sent:", {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });
};

const sendForgotPasswordCode = async (email, code) => {
  const info = await transporter.sendMail({
    from: `"Auto Wash Pro" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Mã xác minh đặt lại mật khẩu Auto Wash Pro",
    html: `
      <h2>Đặt lại mật khẩu</h2>
      <p>Mã xác minh của bạn là:</p>
      <h1 style="letter-spacing: 4px;">${code}</h1>
      <p>Mã này có hiệu lực trong 5 phút.</p>
      <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
    `,
  });

  console.log("[mail] forgot password code sent:", {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });
};

export default {
  sendRegisterCode,
  sendForgotPasswordCode,
};
