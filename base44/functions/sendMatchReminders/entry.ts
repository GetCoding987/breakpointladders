import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Scheduled function — runs daily.
// Finds accepted challenges scheduled for 2 days from now and creates
// match_reminder notifications for both players (entity automation sends the emails).
// Skips challenges that already received a reminder to avoid duplicates.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Calculate target date: 2 calendar days from today (≈48 hours)
    const now = new Date();
    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(now.getDate() + 2);
    const targetDate = twoDaysFromNow.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find accepted challenges with a confirmed date matching the target
    const challenges = await base44.asServiceRole.entities.Challenge.filter({
      status: 'accepted',
      proposal_status: 'accepted',
      proposed_date: targetDate
    });

    let remindersSent = 0;
    let skipped = 0;

    for (const challenge of challenges) {
      // Check if a reminder was already sent (prevents duplicates across runs)
      const existing = await base44.asServiceRole.entities.Notification.filter({
        type: 'match_reminder',
        related_id: challenge.id
      });

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Look up both players for names
      let p1Name = 'Your opponent';
      let p2Name = 'Your opponent';
      try {
        const player1 = await base44.asServiceRole.entities.User.get(challenge.challenger_id);
        if (player1?.full_name) p1Name = player1.full_name;
      } catch { /* keep default */ }
      try {
        const player2 = await base44.asServiceRole.entities.User.get(challenge.opponent_id);
        if (player2?.full_name) p2Name = player2.full_name;
      } catch { /* keep default */ }

      const matchInfo = `Date: ${challenge.proposed_date}` +
        (challenge.proposed_time ? `\nTime: ${challenge.proposed_time}` : '') +
        (challenge.proposed_location ? `\nLocation: ${challenge.proposed_location}` : '');

      // Create reminder notifications for both players
      // (the sendNotificationEmail entity automation will handle the actual emails)
      await base44.asServiceRole.entities.Notification.create({
        user_id: challenge.challenger_id,
        type: 'match_reminder',
        title: 'Match Reminder — 48 Hours Until Your Match',
        body: `Your match against ${p2Name} is in 48 hours.\n\n${matchInfo}\n\nGood luck!`,
        read: false,
        related_id: challenge.id
      });

      await base44.asServiceRole.entities.Notification.create({
        user_id: challenge.opponent_id,
        type: 'match_reminder',
        title: 'Match Reminder — 48 Hours Until Your Match',
        body: `Your match against ${p1Name} is in 48 hours.\n\n${matchInfo}\n\nGood luck!`,
        read: false,
        related_id: challenge.id
      });

      remindersSent += 2;
    }

    return Response.json({
      success: true,
      targetDate,
      challengesFound: challenges.length,
      remindersSent,
      skipped
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});