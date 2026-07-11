import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Scheduled function — runs daily.
// Finds memberships expiring in 3 days and creates membership_expiring
// notifications (entity automation sends the emails via Gmail).
// Skips members who already received a reminder to avoid duplicates.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Calculate target date: 3 days from today
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);
    const targetDate = threeDaysFromNow.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find active memberships expiring on the target date
    const memberships = await base44.asServiceRole.entities.LadderMembership.filter({
      membership_expires: targetDate,
      status: 'active'
    });

    let remindersSent = 0;
    let skipped = 0;

    for (const membership of memberships) {
      // Check if a reminder was already sent (prevents duplicates across runs)
      const existing = await base44.asServiceRole.entities.Notification.filter({
        type: 'membership_expiring',
        related_id: membership.id
      });

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Format expiry date for display
      const expiryFormatted = new Date(membership.membership_expires).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      await base44.asServiceRole.entities.Notification.create({
        user_id: membership.user_id,
        type: 'membership_expiring',
        title: 'Your Season Membership Expires in 3 Days',
        body: `Your Break Point ladder membership expires on ${expiryFormatted}. ` +
          `Renew now to keep your spot in the ladder and avoid being frozen out.\n\n` +
          `Click the button below to renew your season membership.`,
        read: false,
        related_id: membership.id
      });

      remindersSent++;
    }

    return Response.json({
      success: true,
      targetDate,
      membershipsFound: memberships.length,
      remindersSent,
      skipped
    });
  } catch (error) {
    console.error('sendMembershipExpiryReminders error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});