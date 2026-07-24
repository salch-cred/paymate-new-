import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { InteractionType, InteractionResponseType } from 'discord-interactions';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('x-signature-timestamp');
    const bodyText = await req.text();

    if (!signature || !timestamp || !process.env.DISCORD_PUBLIC_KEY) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }

    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + bodyText),
      Buffer.from(signature, 'hex'),
      Buffer.from(process.env.DISCORD_PUBLIC_KEY, 'hex')
    );

    if (!isVerified) {
      return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
    }

    // Strict Replay Attack Prevention
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - requestTime) > 60) {
      return NextResponse.json({ error: 'Request expired (potential replay attack)' }, { status: 401 });
    }

    const body = JSON.parse(bodyText);

    // Handle Discord Ping (required by Discord)
    if (body.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }

    // Handle Application Commands
    if (body.type === InteractionType.APPLICATION_COMMAND) {
      if (body.data.name === 'paymate') {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Welcome to **PayMate**! Create verified invoices powered by AI, settling instantly on the GOAT Network.",
            flags: 64, // EPHEMERAL
            components: [
              {
                type: 1, // ActionRow
                components: [
                  {
                    type: 2, // Button
                    style: 5, // Link
                    label: "Launch App",
                    url: "https://paymateagent.xyz",
                  },
                  {
                    type: 2, // Button
                    style: 5, // Link
                    label: "Join ClawUp Bootcamp",
                    url: "https://clawup.org/?ref=f3508f7af8",
                  }
                ]
              }
            ]
          }
        });
      }

      if (body.data.name === 'invoice') {
        // RBAC Security Check
        const permissions = body.member?.permissions ? BigInt(body.member.permissions) : BigInt(0);
        const isAdministrator = (permissions & BigInt(0x8)) !== BigInt(0); // 0x8 is the Administrator permission bit
        const userRoles = body.member?.roles || [];
        const isAuthorized = isAdministrator || userRoles.includes(process.env.DISCORD_ADMIN_ROLE_ID || 'mock_role_id');

        if (!isAuthorized) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "🚫 **Security Alert:** You do not have the required Administrator permissions to generate an official PayMate invoice for this server.",
              flags: 64, // EPHEMERAL
            }
          });
        }

        const detailsOption = body.data.options?.find((opt: any) => opt.name === 'details');
        const prompt = detailsOption ? detailsOption.value : '';
        const encodedPrompt = encodeURIComponent(prompt);

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `I've started drafting your invoice for: **"${prompt}"**\n\nClick below to securely review and create the payment link on the GOAT Network.`,
            flags: 64, // EPHEMERAL - only the user who typed the command can see this
            components: [
              {
                type: 1, // ActionRow
                components: [
                  {
                    type: 2, // Button
                    style: 5, // Link
                    label: "Review & Send Invoice",
                    url: `https://paymateagent.xyz/dashboard?prompt=${encodedPrompt}`,
                  }
                ]
              }
            ]
          }
        });
      }
    }

    return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 });
  } catch (error) {
    console.error('Error handling Discord interaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
