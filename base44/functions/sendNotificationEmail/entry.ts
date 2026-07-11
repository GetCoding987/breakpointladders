import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Triggered by entity automation on Notification create.
// Looks up the recipient's email and sends it via Gmail.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Entity automation payload: { event, data, old_data, payload_too_large }
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Reject direct HTTP requests — only entity automation triggers are allowed.
    if (
      !body.event ||
      body.event.type !== 'create' ||
      body.event.entity_name !== 'Notification' ||
      !body.event.entity_id
    ) {
      return Response.json({ error: 'Unauthorized: direct calls not permitted' }, { status: 403 });
    }

    // Fetch the notification from the DB by entity_id rather than trusting body.data.
    // This ensures email content comes from the system-created record, not request body.
    let notification;
    try {
      notification = await base44.asServiceRole.entities.Notification.get(body.event.entity_id);
    } catch {
      return Response.json({ skipped: true, reason: 'notification not found' });
    }
    if (!notification || !notification.user_id || !notification.type) {
      return Response.json({ error: 'Missing notification data' }, { status: 400 });
    }

    // Player-facing event types that should trigger an email
    const EMAILED_TYPES = [
      'challenge_received',
      'challenge_accepted',
      'challenge_declined',
      'score_submitted',
      'score_confirmed',
      'score_disputed',
      'new_message',
      'match_reminder',
      'membership_expiring',
      'membership_expired'
    ];

    if (!EMAILED_TYPES.includes(notification.type)) {
      return Response.json({ skipped: true, reason: 'notification type not emailed' });
    }

    // Look up the recipient user to get their email
    let user;
    try {
      user = await base44.asServiceRole.entities.User.get(notification.user_id);
    } catch {
      return Response.json({ skipped: true, reason: 'could not look up user' });
    }

    if (!user || !user.email) {
      return Response.json({ skipped: true, reason: 'no email on file for user' });
    }

    const appUrl = 'https://breakpointladders.base44.app';
    const logoUrl = 'https://media.base44.com/images/public/6a373346ca2369c384afdb52/a42b296e2_BPW_OptionA_dark-bg_white-wordmark_transparent_900x300.png';

    // Escape HTML in user-controlled fields to prevent injection into the email template
    const escapeHtml = (str) => String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const firstName = escapeHtml(user.full_name ? user.full_name.split(' ')[0] : 'Player');
    const bodyHtml = escapeHtml(notification.body || '').replace(/\n/g, '<br/>');

    // Membership notifications link directly to the payment/join page
    const isMembershipNotice = notification.type === 'membership_expiring' || notification.type === 'membership_expired';
    const ctaUrl = isMembershipNotice ? `${appUrl}/join` : appUrl;
    const ctaLabel = isMembershipNotice ? 'Renew Membership' : 'View on Break Point';

    // Clean, minimalist template: top links → logo on navy → body → CTA → footer
    const emailBody =
      `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">` +
      // Top links
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 32px;">` +
        `<tr>` +
          `<td align="left" style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #999999;">` +
            `<a href="${appUrl}/login" style="color: #999999; text-decoration: none;">Sign In</a>` +
          `</td>` +
          `<td align="right" style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #999999;">` +
            `<a href="${appUrl}" style="color: #999999; text-decoration: none;">View in Browser</a>` +
          `</td>` +
        `</tr>` +
      `</table>` +
      // Logo on navy band
      `<div style="background: hsl(217, 72%, 16%); padding: 40px 32px; text-align: center;">` +
        `<img src="${logoUrl}" alt="Break Point Westchester" style="max-width: 240px; height: auto;" />` +
      `</div>` +
      // Body
      `<div style="padding: 48px 32px 24px 32px;">` +
        `<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #333333;">Hi ${firstName},</p>` +
        `<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #333333;">${bodyHtml}</p>` +
      `</div>` +
      // CTA button
      `<div style="padding: 8px 32px 48px 32px; text-align: center;">` +
        `<a href="${ctaUrl}" style="display: inline-block; background: hsl(142, 50%, 45%); color: #ffffff; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; text-decoration: none; padding: 16px 48px; border-radius: 999px;">${ctaLabel}</a>` +
      `</div>` +
      // Footer
      `<div style="padding: 24px 32px 40px 32px; text-align: center; border-top: 1px solid #eeeeee;">` +
        `<p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999999;">The Break Point Ladder Team<br/>` +
        `<a href="${appUrl}" style="color: #999999; text-decoration: none;">${appUrl.replace('https://', '')}</a></p>` +
      `</div>` +
      `</div>`;

    // Build RFC 2822 MIME message
    // Strip newlines from subject to prevent MIME header injection
    const subject = (notification.title || 'Break Point Ladder Notification').replace(/[\r\n]/g, '');
    const mimeMessage =
      `From: The Break Point Ladder Team\r\n` +
      `To: ${user.email}\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n` +
      `\r\n` +
      `${emailBody}`;

    // Base64url encode for Gmail API
    const raw = btoa(unescape(encodeURIComponent(mimeMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Send via Gmail API
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gmail API error:', response.status, errorText);
      return Response.json({ error: `Gmail API error: ${response.status}` }, { status: 500 });
    }

    const result = await response.json();
    return Response.json({ success: true, sent_to: user.email, message_id: result.id });
  } catch (error) {
    console.error('sendNotificationEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});