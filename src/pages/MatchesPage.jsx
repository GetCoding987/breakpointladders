import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Activity, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PlayerAvatar from '@/components/PlayerAvatar';
import ScoreInput from '@/components/ScoreInput';
import { getDisplayName } from '@/utils/userHelpers';
import { formatEasternDateFull, formatEasternDateTime, formatDateOnly } from '@/utils/easternTime';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MatchesPage() {
  const [user, setUser] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [matches, setMatches] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    challenge_id: '',
    sets: [
      { p1: '', p2: '' }
    ],
    retiredBy: null,
    played_date: ''
  });
  const [scoreValidation, setScoreValidation] = useState({ valid: false, error: null, winnerId: null, score: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Dispute dialog state
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const challengeId = searchParams.get('challenge');
    if (challengeId) {
      setSubmitForm(f => ({ ...f, challenge_id: challengeId }));
      setShowSubmit(true);
    }
  }, [searchParams]);

  const load = async () => {
    setLoading(true);
    const u = await base44.auth.me();
    setUser(u);

    const mems = await base44.entities.LadderMembership.filter({ user_id: u.id });
    if (mems.length === 0) { setLoading(false); return; }
    const mem = mems[0];
    setMyMembership(mem);

    const allMatches = await base44.entities.Match.filter({ ladder_id: mem.ladder_id });
    const mine = allMatches.filter(m => m.player1_id === u.id || m.player2_id === u.id);
    setMatches(mine.sort((a, b) => new Date(b.played_date || b.created_date) - new Date(a.played_date || a.created_date)));

    const allChallenges = await base44.entities.Challenge.filter({ ladder_id: mem.ladder_id });
    const accepted = allChallenges.filter(c =>
      c.status === 'accepted' && (c.challenger_id === u.id || c.opponent_id === u.id)
    );
    setChallenges(accepted);

    const allMems = await base44.entities.LadderMembership.filter({ ladder_id: mem.ladder_id });
    const map = {};
    allMems.forEach(m => { map[m.user_id] = { id: m.user_id, full_name: m.display_name, avatar_url: m.avatar_url, location: m.location, city: m.city, state: m.state }; });
    map[u.id] = u;
    setAllUsers(map);

    // Auto-confirm expired pending matches (48-hour deadline)
    try {
      const now = new Date();
      const expired = mine.filter(m =>
        m.status === 'pending_confirmation' &&
        m.confirmation_deadline &&
        new Date(m.confirmation_deadline) < now
      );
      if (expired.length > 0) {
        for (const m of expired) {
          await base44.entities.Match.update(m.id, {
            status: 'confirmed',
            confirmed_by_id: m.submitted_by_id,
            ranking_updated: true,
          });
          const challengerMem = allMems.find(mem => mem.user_id === m.player1_id);
          const opponentMem = allMems.find(mem => mem.user_id === m.player2_id);
          if (m.winner_id === m.player1_id && challengerMem && opponentMem) {
            const opponentOldRank = opponentMem.rank;
            await base44.entities.LadderMembership.update(challengerMem.id, {
              rank: opponentOldRank,
              wins: (challengerMem.wins || 0) + 1,
            });
            await base44.entities.LadderMembership.update(opponentMem.id, {
              rank: opponentOldRank + 1,
              losses: (opponentMem.losses || 0) + 1,
            });
          } else if (m.winner_id === m.player2_id && opponentMem && challengerMem) {
            await base44.entities.LadderMembership.update(challengerMem.id, {
              losses: (challengerMem.losses || 0) + 1,
            });
            await base44.entities.LadderMembership.update(opponentMem.id, {
              wins: (opponentMem.wins || 0) + 1,
            });
          }
          await base44.entities.Notification.create({
            user_id: m.submitted_by_id,
            type: 'score_confirmed',
            title: 'Score Auto-Confirmed',
            body: 'Your match result has been auto-confirmed (opponent did not respond within 48 hours). Rankings have been updated.',
            read: false,
            related_id: m.id,
          });
          const otherId = m.player1_id === m.submitted_by_id ? m.player2_id : m.player1_id;
          await base44.entities.Notification.create({
            user_id: otherId,
            type: 'score_confirmed',
            title: 'Score Auto-Confirmed',
            body: 'A match result has been auto-confirmed (you did not respond within 48 hours). Rankings have been updated.',
            read: false,
            related_id: m.id,
          });
        }
        const updatedMatches = mine.map(m =>
          expired.find(e => e.id === m.id)
            ? { ...m, status: 'confirmed', ranking_updated: true }
            : m
        );
        setMatches(updatedMatches.sort((a, b) => new Date(b.played_date || b.created_date) - new Date(a.played_date || a.created_date)));
      }
    } catch (err) {
      console.warn('Auto-confirm failed:', err?.message);
    }

    setLoading(false);
  };

  const submitScore = async () => {
    if (!scoreValidation.valid || !scoreValidation.winnerId) return;
    setSubmitting(true);

    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const challenge = challenges.find(c => c.id === submitForm.challenge_id);

    const match = await base44.entities.Match.create({
      challenge_id: submitForm.challenge_id,
      ladder_id: myMembership.ladder_id,
      player1_id: challenge?.challenger_id || user.id,
      player2_id: challenge?.opponent_id || '',
      winner_id: scoreValidation.winnerId,
      score: scoreValidation.score,
      played_date: submitForm.played_date || new Date().toISOString().split('T')[0],
      submitted_by_id: user.id,
      status: 'pending_confirmation',
      confirmation_deadline: deadline,
      ranking_updated: false,
    });

    const otherId = challenge
      ? (challenge.challenger_id === user.id ? challenge.opponent_id : challenge.challenger_id)
      : '';
    if (otherId) {
      await base44.entities.Notification.create({
        user_id: otherId,
        type: 'score_submitted',
        title: 'Score Submitted',
        body: `${getDisplayName(user)} submitted the match result. Please confirm within 24 hours.`,
        read: false,
        related_id: match.id,
      });
    }

    if (submitForm.challenge_id) {
      await base44.entities.Challenge.update(submitForm.challenge_id, { status: 'completed' });
    }

    setShowSubmit(false);
    setSubmitForm({ challenge_id: '', sets: [{ p1: '', p2: '' }], retiredBy: null, played_date: '' });
    setScoreValidation({ valid: false, error: null, winnerId: null, score: '' });
    setSubmitting(false);
    load();
  };

  const confirmScore = async (match) => {
    await base44.entities.Match.update(match.id, {
      status: 'confirmed',
      confirmed_by_id: user.id,
      ranking_updated: true,
    });

    const allMems = await base44.entities.LadderMembership.filter({ ladder_id: myMembership.ladder_id });
    const challengerMem = allMems.find(m => m.user_id === match.player1_id);
    const opponentMem = allMems.find(m => m.user_id === match.player2_id);

    if (match.winner_id === match.player1_id && challengerMem && opponentMem) {
      const opponentOldRank = opponentMem.rank;
      await base44.entities.LadderMembership.update(challengerMem.id, {
        rank: opponentOldRank,
        wins: (challengerMem.wins || 0) + 1,
      });
      await base44.entities.LadderMembership.update(opponentMem.id, {
        rank: opponentOldRank + 1,
        losses: (opponentMem.losses || 0) + 1,
      });
    } else if (match.winner_id === match.player2_id && opponentMem && challengerMem) {
      await base44.entities.LadderMembership.update(challengerMem.id, {
        losses: (challengerMem.losses || 0) + 1,
      });
      await base44.entities.LadderMembership.update(opponentMem.id, {
        wins: (opponentMem.wins || 0) + 1,
      });
    }

    await base44.entities.Notification.create({
      user_id: match.submitted_by_id,
      type: 'score_confirmed',
      title: 'Score Confirmed',
      body: 'Your match result has been confirmed. Rankings have been updated.',
      read: false,
      related_id: match.id,
    });

    load();
  };

  const openDispute = (match) => {
    setDisputeTarget(match);
    setDisputeReason('');
  };

  const confirmDispute = async () => {
    if (!disputeReason.trim()) return;
    setDisputing(true);

    const otherId = disputeTarget.player1_id === user.id ? disputeTarget.player2_id : disputeTarget.player1_id;
    const threadId = [user.id, otherId].sort().join('_');

    await base44.entities.Match.update(disputeTarget.id, {
      status: 'disputed',
      admin_notes: `Dispute reason: ${disputeReason.trim()}`,
    });

    // Create initial dispute message in the thread
    await base44.entities.Message.create({
      sender_id: user.id,
      recipient_id: otherId,
      content: `I'm disputing the score for our match (${disputeTarget.score}). Reason: ${disputeReason.trim()}\n\nLet's discuss and agree on the correct score, or notify an admin if we can't agree.`,
      read: false,
      thread_id: threadId,
      match_id: disputeTarget.id,
    });

    // Notify the other player
    await base44.entities.Notification.create({
      user_id: otherId,
      type: 'score_disputed',
      title: 'Score Disputed',
      body: `${getDisplayName(user)} disputed the match score. Please discuss and agree on the correct score.`,
      read: false,
      related_id: disputeTarget.id,
    });

    const matchId = disputeTarget.id;
    setDisputeTarget(null);
    setDisputeReason('');
    setDisputing(false);
    navigate(`/messages?dispute=${matchId}`);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  const pendingConfirmation = matches.filter(m =>
    m.status === 'pending_confirmation' && m.submitted_by_id !== user?.id
  );
  const confirmedMatches = matches.filter(m => m.status === 'confirmed');

  const selectedChallenge = challenges.find(c => c.id === submitForm.challenge_id);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Matches</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your match history and pending results</p>
        </div>
        {challenges.length > 0 && (
          <Button onClick={() => {
            if (challenges.length === 1) setSubmitForm(f => ({ ...f, challenge_id: challenges[0].id }));
            setShowSubmit(true);
          }} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2">
            <Activity className="w-4 h-4" />
            Submit Score
          </Button>
        )}
      </div>

      {/* Pending confirmation */}
      {pendingConfirmation.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Awaiting Your Confirmation
          </h2>
          <div className="space-y-3">
            {pendingConfirmation.map(m => {
              const opponent = allUsers[m.player1_id === user?.id ? m.player2_id : m.player1_id];
              const winner = allUsers[m.winner_id];
              return (
                <div key={m.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <PlayerAvatar user={opponent} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">Match vs {getDisplayName(opponent)}</p>
                      <p className="text-sm text-muted-foreground">Score: <strong>{m.score}</strong></p>
                      <p className="text-sm text-muted-foreground">Winner reported: <strong>{getDisplayName(winner)}</strong></p>
                      {m.confirmation_deadline && (
                        <p className="text-xs text-amber-600 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Confirm by {formatEasternDateTime(m.confirmation_deadline)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => confirmScore(m)} className="bg-green-600 hover:bg-green-700 gap-1 h-8 text-xs">
                        <CheckCircle className="w-3 h-3" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDispute(m)} className="h-8 text-xs text-red-600 border-red-200">
                        <AlertCircle className="w-3 h-3 mr-1" /> Dispute
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All matches */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-bold">Match History</h2>
        </div>
        <div className="divide-y divide-border">
          {matches.map(m => {
            const opponentId = m.player1_id === user?.id ? m.player2_id : m.player1_id;
            const opponent = allUsers[opponentId];
            const won = m.winner_id === user?.id;
            return (
              <div key={m.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 px-4 md:px-6 py-4">
                <PlayerAvatar user={opponent} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{getDisplayName(user)} vs {getDisplayName(opponent)}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.played_date ? formatDateOnly(m.played_date) : '—'}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <p className="text-sm font-bold">{m.score || '—'}</p>
                  {m.status === 'pending_confirmation' ? (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Pending</span>
                  ) : m.status === 'disputed' ? (
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">Disputed</span>
                  ) : m.status === 'confirmed' ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {won ? 'Win' : 'Loss'}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {matches.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No matches recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Submit Score Dialog */}
      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit Match Score</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {challenges.length > 1 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Match</label>
                <Select value={submitForm.challenge_id} onValueChange={v => setSubmitForm(f => ({ ...f, challenge_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a challenge" />
                  </SelectTrigger>
                  <SelectContent>
                    {challenges.map(c => {
                      const otherId = c.challenger_id === user?.id ? c.opponent_id : c.challenger_id;
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          vs {getDisplayName(allUsers[otherId])}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {submitForm.challenge_id && selectedChallenge && (() => {
              const challenger = allUsers[selectedChallenge.challenger_id];
              const opponent = allUsers[selectedChallenge.opponent_id];
              return (
                <ScoreInput
                  players={[challenger, opponent]}
                  sets={submitForm.sets}
                  retiredBy={submitForm.retiredBy}
                  onSetsChange={(newSets) => setSubmitForm(f => ({ ...f, sets: newSets }))}
                  onRetiredByChange={(id) => setSubmitForm(f => ({ ...f, retiredBy: id }))}
                  onValidationChange={setScoreValidation}
                />
              );
            })()}

            {scoreValidation.valid && scoreValidation.winnerId && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">
                    Winner: {getDisplayName(allUsers[scoreValidation.winnerId])}
                  </p>
                  <p className="text-xs text-green-600">Score: {scoreValidation.score}</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Date Played <span className="text-red-500">*</span></label>
              <Input type="date" value={submitForm.played_date} onChange={e => setSubmitForm(f => ({ ...f, played_date: e.target.value }))} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowSubmit(false)}>Cancel</Button>
              <Button
                onClick={submitScore}
                disabled={!scoreValidation.valid || !submitForm.played_date || submitting}
                className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]"
              >
                {submitting ? 'Submitting...' : 'Submit Score'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={!!disputeTarget} onOpenChange={() => setDisputeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dispute Score</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Please explain why you are disputing this score. An admin will review your dispute.
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Reason for dispute <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="e.g. The score was recorded incorrectly. The actual score was..."
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDisputeTarget(null)}>Cancel</Button>
              <Button
                onClick={confirmDispute}
                disabled={!disputeReason.trim() || disputing}
                className="bg-red-600 hover:bg-red-700 gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {disputing ? 'Submitting...' : 'Submit Dispute'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}