import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendOtpEmail(email: string, code: string) {
  await resend.emails.send({
    from: `Cybrosoft <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Your Cybrosoft login code",
    html: `
      <h2>Cybrosoft Login</h2>
      <p>Your OTP code is:</p>
      <h1>${code}</h1>
      <p>This code expires in 10 minutes.</p>
    `,
  });
}