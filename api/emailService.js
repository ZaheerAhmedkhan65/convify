const nodemailer =  require("nodemailer");

const  handler =  async function(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, text, html } = req.body;

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_SERVER,
      port: process.env.BREVO_SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_SMTP_KEY
      }
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"Zaheer" <ibctank.team@gmail.com>`,
      to,
      subject,
      text,
      html
    });

    return res.status(200).json({ message: "Email sent", id: info.messageId });
  } catch (err) {
    console.error("Error sending email:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}

module.exports = handler;
