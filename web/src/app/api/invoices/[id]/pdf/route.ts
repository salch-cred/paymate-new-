import { NextRequest, NextResponse } from 'next/server';
import { getInvoice } from '@/lib/db';
import { buildPaidBillPdf } from '@/lib/paid-bill-pdf';

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

    // SECURITY (audit fix 2026-08-13): never reveal the real amount for a
    // "private" invoice through this alternate read path either — mirrors
    // the same fix applied to GET /api/invoices/[id]. The paid bill for a
    // private invoice is generated on the client, where the view key has
    // already decrypted the amount.
    const displayAmount = invoice.isPrivate ? 0 : invoice.amountUsd;

    const doc = await buildPaidBillPdf({
      id: invoice.id,
      freelancer: invoice.freelancer,
      client: invoice.client,
      title: invoice.title,
      description: invoice.description,
      amountUsd: displayAmount,
      status: invoice.status,
      chain: invoice.chain,
      dueDate: invoice.dueDate || undefined,
      txHash: invoice.txHash || undefined,
      ipfsReceipt: invoice.ipfsReceipt,
      createdAt: invoice.createdAt,
      paidAt: invoice.paidAt,
      isStream: invoice.isStream,
      streamRateUsd: invoice.streamRateUsd,
      streamedAmountUsd: invoice.streamedAmountUsd,
      splits: invoice.splits || undefined,
      escrowTxHash: invoice.escrowTxHash,
    });

    const buffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="paymate-paid-bill-${invoice.id.split('-')[0]}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
