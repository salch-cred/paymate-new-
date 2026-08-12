import { NextRequest, NextResponse } from 'next/server';
import { getInvoice } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const invoice = await getInvoice(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Receipt - ${invoice.id}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #faf8f4;
            color: #17180f;
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
          }
          .receipt-container {
            background-color: #ffffff;
            width: 100%;
            max-width: 800px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            padding: 40px;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px solid #e8e6df;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .brand {
            font-size: 24px;
            font-weight: 800;
            color: #17180f;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .brand span {
            color: #ff5b2e;
          }
          .invoice-details {
            text-align: right;
            font-size: 14px;
            color: #8a8981;
          }
          .invoice-details h2 {
            margin: 0 0 5px;
            color: #17180f;
            font-size: 20px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .status-paid {
            background-color: #e7f5ec;
            color: #317454;
          }
          .status-pending {
            background-color: #fff0ed;
            color: #b94328;
          }
          .parties {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          .party {
            width: 45%;
          }
          .party h3 {
            font-size: 12px;
            text-transform: uppercase;
            color: #8a8981;
            margin-bottom: 5px;
            letter-spacing: 0.05em;
          }
          .party p {
            font-family: monospace;
            word-break: break-all;
            margin: 0;
            font-size: 14px;
          }
          .summary {
            background-color: #faf8f4;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 40px;
          }
          .summary h3 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 18px;
          }
          .summary p {
            margin: 0 0 15px;
            color: #8a8981;
            font-size: 14px;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #e8e6df;
            padding-top: 15px;
            font-size: 24px;
            font-weight: bold;
          }
          .amount-row span:last-child {
            color: #ff5b2e;
          }
          .tx-info {
            font-size: 13px;
            margin-bottom: 30px;
          }
          .tx-info a {
            color: #ff5b2e;
            text-decoration: none;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #8a8981;
            border-top: 1px solid #e8e6df;
            padding-top: 20px;
            margin-top: 40px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <div class="brand">PayMate<span>.</span></div>
            <div class="invoice-details">
              <h2>RECEIPT</h2>
              <div class="status-badge ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
                ${invoice.status}
              </div>
              <div>Invoice ID: ${invoice.id.split('-')[0]}</div>
              <div>Created: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString()}</div>
              ${invoice.dueDate ? `<div>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</div>` : ''}
            </div>
          </div>

          <div class="parties">
            <div class="party">
              <h3>Billed To (Client)</h3>
              <p>${invoice.client}</p>
            </div>
            <div class="party">
              <h3>Payable To (Freelancer)</h3>
              <p>${invoice.freelancer}</p>
            </div>
          </div>

          <div class="summary">
            <h3>${invoice.title || 'Untitled Invoice'}</h3>
            <p>${invoice.description}</p>
            <div class="amount-row">
              <span>Total Amount</span>
              <span>$${invoice.amountUsd.toLocaleString()} USDC</span>
            </div>
          </div>

          ${invoice.status === 'paid' && invoice.txHash ? `
            <div class="tx-info">
              <strong>Transaction Hash:</strong><br>
              <a href="https://explorer.goat.network/tx/${invoice.txHash}" target="_blank">
                ${invoice.txHash}
              </a>
            </div>
          ` : ''}

          ${invoice.status === 'paid' && invoice.ipfsReceipt ? `
            <div class="tx-info" style="margin-top: 15px;">
              <strong>IPFS Receipt Hash:</strong><br>
              <span style="font-family: monospace; color: #8a8981; font-size: 14px;">
                ${invoice.ipfsReceipt}
              </span>
            </div>
          ` : ''}

          <div class="footer">
            Generated by PayMate · paymateagent.xyz · Settled on GOAT Network
          </div>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="paymate-invoice-${invoice.id.split('-')[0]}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
