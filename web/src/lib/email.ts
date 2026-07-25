import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendReceipt(email: string, invoiceId: string, amount: number) {
  if (!resend) {
    console.log("No RESEND_API_KEY found, skipping email notification.");
    return;
  }

  try {
    await resend.emails.send({
      from: 'PayMate <receipts@paymateagent.xyz>',
      to: [email],
      subject: `Payment Verified: Invoice #${invoiceId.split('-')[0]}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2 style="color: #ff5b2e;">Payment Verified</h2>
          <p>Your invoice payment has been successfully settled on the GOAT Network.</p>
          <div style="background: #f6f5f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Invoice ID:</strong> ${invoiceId}</p>
            <p><strong>Amount:</strong> $${amount.toLocaleString()} USDC</p>
            <p><strong>Status:</strong> PAID</p>
          </div>
          <p>You can view the cryptographic proof of this payment on your dashboard.</p>
          <a href="https://paymateagent.xyz/pay/${invoiceId}" style="display: inline-block; background: #1c1d19; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Receipt</a>
        </div>
      `,
    });
    console.log("Email receipt sent successfully.");
  } catch (error) {
    console.error("Failed to send email receipt:", error);
  }
}
