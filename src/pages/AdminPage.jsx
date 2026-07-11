import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Settings, Trophy, Users, Activity, Plus, Edit, Trash2, AlertCircle, Send, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlayerAvatar from '@/components/PlayerAvatar';
import RankBadge from '@/components/RankBadge';
import FreezeStatusBadge from '@/components/FreezeStatusBadge';
import { formatEasternDateFull, formatDateOnly } from '@/utils/easternTime';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminMessagesTab from '@/components/AdminMessagesTab';
import { getDisplayName } from '@/utils/userHelpers';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [ladders, setLadders] = useState([]);
  const [selectedLadder, setSelectedLadder] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [matches, setMatches] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [showLadderForm, setShowLadderForm] = useState(false);
  const [ladderForm, setLadderForm] = useState({ name: '', description: '', annual_fee: 25, challenge_window_spots: 10 });
  const [editingLadder, setEditingLadder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const u = await base44.auth.me();
    setUser(u);

    if (u.role !== 'admin') { setLoading(false); return; }

    const allLadders = await base44.entities.Ladder.list();
    setLadders(allLadders);
    if (allLadders.length > 0 && !selectedLadder) {
      loadLadderData(allLadders[0]);
    }

    setLoading(false);
  };

  const loadLadderData = async (ladder) => {
    setSelectedLadder(ladder);
    const mems = await base44.entities.LadderMembership.filter({ ladder_id: ladder.id });
    setMemberships(mems.sort((a, b) => (a.rank || 999) - (b.rank || 999)));

    // Build user map from memberships
    const map = {};
    mems.forEach(m => {
      map[m.user_id] = { id: m.user_id, full_name: m.display_name, avatar_url: m.avatar_url, email: m.user_id };
    });
    setAllUsers(map);

    const allMatches = await base44.entities.Match.filter({ ladder_id: ladder.id });
    setMatches(allMatches.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));

    const allChallenges = await base44.entities.Challenge.filter({ ladder_id: ladder.id });
    setChallenges(allChallenges.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
  };

  const saveLadder = async () => {
    if (editingLadder) {
      await base44.entities.Ladder.update(editingLadder.id, ladderForm);
    } else {
      await base44.entities.Ladder.create({ ...ladderForm, status: 'active' });
    }
    setShowLadderForm(false);
    setEditingLadder(null);
    setLadderForm({ name: '', description: '', annual_fee: 25, challenge_window_spots: 10 });
    load();
  };

  const archiveLadder = async (ladder) => {
    await base44.entities.Ladder.update(ladder.id, { status: 'archived' });
    load();
  };

  const updateMemberStatus = async (mem, status) => {
    await base44.entities.LadderMembership.update(mem.id, { status });
    if (selectedLadder) loadLadderData(selectedLadder);
  };

  const updateMemberRank = async (mem, newRank) => {
    await base44.entities.LadderMembership.update(mem.id, { rank: parseInt(newRank) });
    if (selectedLadder) loadLadderData(selectedLadder);
  };

  const removePlayer = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const userId = removeTarget.user_id;
    try {
      await base44.entities.LadderMembership.delete(removeTarget.id);
      await base44.entities.Message.deleteMany({ sender_id: userId });
      await base44.entities.Message.deleteMany({ recipient_id: userId });
      await base44.entities.Challenge.deleteMany({ challenger_id: userId });
      await base44.entities.Challenge.deleteMany({ opponent_id: userId });
      await base44.entities.Match.deleteMany({ player1_id: userId });
      await base44.entities.Match.deleteMany({ player2_id: userId });
    } catch (err) {
      console.warn('Remove player failed:', err?.message);
    }
    setRemoving(false);
    setRemoveTarget(null);
    if (selectedLadder) loadLadderData(selectedLadder);
  };

  const resetSeason = async () => {
    if (!selectedLadder) return;
    setResetting(true);
    try {
      // Delete all matches and challenges for this ladder
      await base44.entities.Match.deleteMany({ ladder_id: selectedLadder.id });
      await base44.entities.Challenge.deleteMany({ ladder_id: selectedLadder.id });

      // Reset wins/losses on all memberships — keep ranks/positions intact
      await base44.entities.LadderMembership.updateMany(
        { ladder_id: selectedLadder.id },
        { $set: { wins: 0, losses: 0 } }
      );

      // Delete all messages between ladder members
      const memberIds = memberships.map(m => m.user_id);
      for (const userId of memberIds) {
        await base44.entities.Message.deleteMany({ sender_id: userId });
        await base44.entities.Message.deleteMany({ recipient_id: userId });
      }
    } catch (err) {
      console.warn('Season reset failed:', err?.message);
    }
    setResetting(false);
    setShowResetConfirm(false);
    if (selectedLadder) loadLadderData(selectedLadder);
  };

  const overrideMatch = async (match, winnerId) => {
    await base44.entities.Match.update(match.id, {
      winner_id: winnerId,
      status: 'overridden',
      ranking_updated: false,
    });
    if (selectedLadder) loadLadderData(selectedLadder);
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    const activeMembers = memberships.filter(m => m.status === 'active' && m.user_id !== user.id);
    const messages = activeMembers.map(mem => ({
      sender_id: user.id,
      recipient_id: mem.user_id,
      content: broadcastMsg.trim(),
      read: false,
      thread_id: [user.id, mem.user_id].sort().join('_'),
    }));
    const notifs = activeMembers.map(mem => ({
      user_id: mem.user_id,
      type: 'new_message',
      title: 'Broadcast Message',
      body: `${getDisplayName(user)} sent a broadcast message to all ladder members`,
      read: false,
    }));
    try {
      await base44.entities.Message.bulkCreate(messages);
      await base44.entities.Notification.bulkCreate(notifs);
    } catch (err) {
      console.warn('Broadcast failed:', err?.message);
    }
    setBroadcasting(false);
    setShowBroadcast(false);
    setBroadcastMsg('');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="font-semibold text-lg">Admin access required</p>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  const disputedMatches = matches.filter(m => m.status === 'disputed');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage ladders, players, and matches</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Trophy, label: 'Total Ladders', value: ladders.filter(l => l.status === 'active').length, color: 'text-blue-600 bg-blue-50' },
          { icon: Users, label: 'Total Players', value: memberships.length, color: 'text-green-600 bg-green-50' },
          { icon: Activity, label: 'Total Matches', value: matches.length, color: 'text-purple-600 bg-purple-50' },
          { icon: AlertCircle, label: 'Disputed', value: disputedMatches.length, color: 'text-red-600 bg-red-50' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
                <p className="text-3xl font-bold mt-1">{value}</p>
              </div>
              <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="ladders">
        <TabsList className="mb-6">
          <TabsTrigger value="ladders">Ladders</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        {/* Ladders tab */}
        <TabsContent value="ladders">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg">All Ladders</h2>
            <Button
              onClick={() => { setEditingLadder(null); setLadderForm({ name: '', description: '', annual_fee: 25, challenge_window_spots: 10 }); setShowLadderForm(true); }}
              className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2"
            >
              <Plus className="w-4 h-4" /> New Ladder
            </Button>
          </div>
          <div className="grid gap-3">
            {ladders.map(ladder => (
              <div key={ladder.id} className={`bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4 ${selectedLadder?.id === ladder.id ? 'border-blue-300 bg-blue-50/30' : ''}`}>
                <Trophy className="w-8 h-8 text-[hsl(217,72%,40%)]" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{ladder.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ladder.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {ladder.status}
                    </span>
                  </div>
                  {ladder.description && <p className="text-sm text-muted-foreground">{ladder.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    ${ladder.annual_fee}/season · Challenge window: ±{ladder.challenge_window_spots} spots
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadLadderData(ladder)}
                    className="h-8 text-xs"
                  >
                    Select
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditingLadder(ladder); setLadderForm({ name: ladder.name, description: ladder.description || '', annual_fee: ladder.annual_fee, challenge_window_spots: ladder.challenge_window_spots || 10 }); setShowLadderForm(true); }}
                    className="h-8 text-xs"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  {ladder.status === 'active' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { loadLadderData(ladder); setShowResetConfirm(true); }}
                        className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Season
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => archiveLadder(ladder)} className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50">
                        Archive
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Players tab */}
        <TabsContent value="players">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-lg">Players</h2>
              <span className="text-sm text-muted-foreground">— {selectedLadder?.name}</span>
            </div>
            <Button onClick={() => setShowBroadcast(true)} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2">
              <Send className="w-4 h-4" /> Broadcast Message
            </Button>
          </div>
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {memberships.map(mem => {
                const memberUser = allUsers[mem.user_id];
                return (
                  <div key={mem.id} className="flex items-center gap-4 px-6 py-4">
                    <RankBadge rank={mem.rank} size="sm" />
                    <PlayerAvatar user={memberUser} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{getDisplayName(memberUser)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{memberUser?.email}</p>
                        <FreezeStatusBadge status={mem.status} />
                      </div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-sm font-bold">{mem.wins || 0}W-{mem.losses || 0}L</p>
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {mem.membership_expires ? `Expires ${formatDateOnly(mem.membership_expires)}` : 'No expiry'}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Rank:</span>
                        <Input
                          type="number"
                          defaultValue={mem.rank}
                          onBlur={e => updateMemberRank(mem, e.target.value)}
                          className="w-14 h-7 text-xs text-center"
                        />
                      </div>
                      <Select value={mem.status} onValueChange={val => updateMemberStatus(mem, val)}>
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="frozen_voluntary">Frozen (Vol.)</SelectItem>
                          <SelectItem value="frozen_expired">Frozen (Exp.)</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRemoveTarget(mem)}
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
              {memberships.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">No players on this ladder yet</div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Matches tab */}
        <TabsContent value="matches">
          <h2 className="font-bold text-lg mb-4">Matches — {selectedLadder?.name}</h2>
          {disputedMatches.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="font-semibold text-red-800 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {disputedMatches.length} disputed match(es) require attention
              </p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {matches.slice(0, 30).map(m => {
                const p1 = allUsers[m.player1_id];
                const p2 = allUsers[m.player2_id];
                const winner = allUsers[m.winner_id];
                return (
                  <div key={m.id} className={`flex items-center gap-4 px-6 py-4 ${m.status === 'disputed' ? 'bg-red-50' : ''}`}>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{getDisplayName(p1)} vs {getDisplayName(p2)}</p>
                      <p className="text-xs text-muted-foreground">
                        Score: {m.score || '—'} · Winner: {getDisplayName(winner)} ·{' '}
                        {m.played_date ? formatEasternDateFull(m.played_date) : '—'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      m.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      m.status === 'disputed' ? 'bg-red-100 text-red-700' :
                      m.status === 'pending_confirmation' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {m.status.replace('_', ' ')}
                    </span>
                    {m.status === 'disputed' && (
                      <div className="flex gap-1">
                        {[m.player1_id, m.player2_id].map(pid => (
                          <Button key={pid} size="sm" variant="outline" onClick={() => overrideMatch(m, pid)} className="h-7 text-xs">
                            {getDisplayName(allUsers[pid])?.split(' ')[0]} won
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {matches.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">No matches recorded</div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Challenges tab */}
        <TabsContent value="challenges">
          <h2 className="font-bold text-lg mb-4">Challenges — {selectedLadder?.name}</h2>
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {challenges.slice(0, 30).map(c => {
                const challenger = allUsers[c.challenger_id];
                const opponent = allUsers[c.opponent_id];
                return (
                  <div key={c.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {getDisplayName(challenger)} <span className="text-muted-foreground font-normal">challenged</span> {getDisplayName(opponent)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{c.challenger_rank_at_time} vs #{c.opponent_rank_at_time} ·{' '}
                        {c.created_date ? formatEasternDateFull(c.created_date) : '—'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      c.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      c.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      c.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                      c.status === 'declined' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                );
              })}
              {challenges.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">No challenges on this ladder</div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Messages tab */}
        <TabsContent value="messages">
          <AdminMessagesTab user={user} ladderId={selectedLadder?.id} />
        </TabsContent>
      </Tabs>

      {/* Ladder form dialog */}
      <Dialog open={showLadderForm} onOpenChange={setShowLadderForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLadder ? 'Edit Ladder' : 'Create New Ladder'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Ladder Name *</label>
              <Input value={ladderForm.name} onChange={e => setLadderForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Men's Singles" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea value={ladderForm.description} onChange={e => setLadderForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Season Fee ($)</label>
                <Input type="number" value={ladderForm.annual_fee} onChange={e => setLadderForm(f => ({ ...f, annual_fee: parseFloat(e.target.value) }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Challenge Window (spots)</label>
                <Input type="number" value={ladderForm.challenge_window_spots} onChange={e => setLadderForm(f => ({ ...f, challenge_window_spots: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowLadderForm(false)}>Cancel</Button>
              <Button onClick={saveLadder} disabled={!ladderForm.name} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]">
                {editingLadder ? 'Save Changes' : 'Create Ladder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast message dialog */}
      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Broadcast Message to All Players</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              This message will be sent to all active members on <strong>{selectedLadder?.name}</strong>. They will receive it as a direct message from you.
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Message <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="e.g. Reminder: All matches must be completed by July 15th..."
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowBroadcast(false)}>Cancel</Button>
              <Button
                onClick={sendBroadcast}
                disabled={!broadcastMsg.trim() || broadcasting}
                className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2"
              >
                <Send className="w-4 h-4" />
                {broadcasting ? 'Sending...' : 'Send to All'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Remove player confirmation dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Player</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <strong>{getDisplayName(allUsers[removeTarget?.user_id])}</strong> from <strong>{selectedLadder?.name}</strong>?
            </p>
            <p className="text-sm text-red-600 font-medium">
              This will permanently delete their ladder membership, all their messages, challenges, and match data. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
              <Button
                onClick={removePlayer}
                disabled={removing}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {removing ? 'Removing...' : 'Remove Player'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Season reset confirmation dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Season — {selectedLadder?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              This will <strong>permanently delete</strong> all matches, challenges, and messages for this ladder, and reset every player's win-loss record to 0-0.
            </p>
            <p className="text-sm font-medium text-green-700">
              ✓ Ladder positions (ranks) will be preserved.
            </p>
            <p className="text-sm text-red-600 font-medium">
              This action cannot be undone. Make sure the season is truly over before proceeding.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
              <Button
                onClick={resetSeason}
                disabled={resetting}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {resetting ? 'Resetting...' : 'Reset Season'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}