import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, getCurrentUser, callApi } from '@/lib/supabaseClient';
import { Send, Search, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PlayerAvatar from '@/components/PlayerAvatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DisputePanel from '@/components/DisputePanel';
import ProposeScoreDialog from '@/components/ProposeScoreDialog';
import MatchSchedulePanel from '@/components/MatchSchedulePanel';
import ProposeScheduleDialog from '@/components/ProposeScheduleDialog';
import { updateRankingsForMatch } from '@/utils/matchRanking';
import { getDisplayName } from '@/utils/userHelpers';
import { formatEasternTime, formatEasternDate, parseDateUTC } from '@/utils/easternTime';
import { withRetry } from '@/utils/apiRetry';

export default function MessagesPage() {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState({});
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState('');
  const [disputedMatches, setDisputedMatches] = useState([]);
  const [activeDisputeMatch, setActiveDisputeMatch] = useState(null);
  const [showProposeScore, setShowProposeScore] = useState(false);
  const [notifyingAdmin, setNotifyingAdmin] = useState(false);
  const [acceptedChallenges, setAcceptedChallenges] = useState([]);
  const [activeScheduleChallenge, setActiveScheduleChallenge] = useState(null);
  const [showProposeSchedule, setShowProposeSchedule] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('propose');
  const messagesEndRef = useRef(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    load();
  }, []);

  // Real-time: update accepted challenges when a proposal/acceptance changes
  useEffect(() => {
    const channel = supabase
      .channel('messages-page-challenges')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'challenges' }, (payload) => {
        const updated = payload.new;
        setAcceptedChallenges(prev => {
          const exists = prev.find(c => c.id === updated.id);
          if (!exists) return prev;
          return prev.map(c => c.id === updated.id ? { ...c, ...updated } : c);
        });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    }, 50);
  }, [threadMessages, selectedThread]);

  const load = async () => {
    setLoading(true);
    const u = await getCurrentUser();
    setUser(u);

    // Fetch messages and own memberships in parallel
    const [{ data: sent }, { data: received }, { data: myMems }] = await Promise.all([
      withRetry(() => supabase.from('messages').select('*').match({ sender_id: u.id })),
      withRetry(() => supabase.from('messages').select('*').match({ recipient_id: u.id })),
      withRetry(() => supabase.from('ladder_memberships').select('*').match({ user_id: u.id })),
    ]);

    // Build thread map
    const allMsgs = [...(sent || []), ...(received || [])];
    const threadMap = {};
    allMsgs.forEach(msg => {
      const otherId = msg.sender_id === u.id ? msg.recipient_id : msg.sender_id;
      if (!threadMap[otherId]) threadMap[otherId] = [];
      threadMap[otherId].push(msg);
    });

    const threadList = Object.entries(threadMap).map(([otherId, msgs]) => ({
      otherId,
      messages: msgs.sort((a, b) => parseDateUTC(a.created_date) - parseDateUTC(b.created_date)),
      lastMessage: msgs.sort((a, b) => parseDateUTC(b.created_date) - parseDateUTC(a.created_date))[0],
      unreadCount: msgs.filter(m => m.recipient_id === u.id && !m.read).length,
    })).sort((a, b) => parseDateUTC(b.lastMessage?.created_date) - parseDateUTC(a.lastMessage?.created_date));

    setThreads(threadList);

    if (myMems?.length > 0) {
      const ladderId = myMems[0].ladder_id;

      // Fetch ladder members, matches, and challenges in parallel
      const [{ data: allMems }, { data: allMatches }, { data: allChallenges }] = await Promise.all([
        withRetry(() => supabase.from('ladder_memberships').select('*').match({ ladder_id: ladderId })),
        withRetry(() => supabase.from('matches').select('*').match({ ladder_id: ladderId })),
        withRetry(() => supabase.from('challenges').select('*').match({ ladder_id: ladderId })),
      ]);

      const map = {};
      (allMems || []).forEach(m => {
        map[m.user_id] = { id: m.user_id, full_name: m.display_name, avatar_url: m.avatar_url, location: m.location };
      });
      map[u.id] = u;
      setAllUsers(map);

      setDisputedMatches((allMatches || []).filter(m =>
        (m.player1_id === u.id || m.player2_id === u.id) && m.status === 'disputed'
      ));

      setAcceptedChallenges((allChallenges || []).filter(c =>
        (c.challenger_id === u.id || c.opponent_id === u.id) && c.status === 'accepted'
      ));
    }

    setLoading(false);
  };

  const openThread = async (thread) => {
    setSelectedThread(thread);
    setThreadMessages(thread.messages);

    // Mark messages as read and update local state (no full reload needed)
    const unread = thread.messages.filter(m => m.recipient_id === user?.id && !m.read);
    if (unread.length === 0) return;

    for (const msg of unread) {
      await supabase.from('messages').update({ read: true }).eq('id', msg.id);
    }

    setThreads(prev => prev.map(t =>
      t.otherId === thread.otherId
        ? { ...t, unreadCount: 0, messages: t.messages.map(m => ({ ...m, read: true })) }
        : t
    ));
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    setSending(true);

    const { data: msg } = await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: selectedThread.otherId,
      content: newMessage.trim(),
      read: false,
      thread_id: [user.id, selectedThread.otherId].sort().join('_'),
    }).select().single();

    await callApi('/api/notify', {
      user_id: selectedThread.otherId,
      type: 'new_message',
      title: `New message from ${getDisplayName(user)}`,
      body: newMessage.trim().slice(0, 100),
    });

    setNewMessage('');
    setSending(false);

    // Update local state (no full reload needed)
    const newMsg = { ...msg, created_date: new Date().toISOString() };
    const updated = [...threadMessages, newMsg];
    setThreadMessages(updated);
    setThreads(prev => prev.map(t =>
      t.otherId === selectedThread.otherId
        ? { ...t, messages: updated, lastMessage: newMsg }
        : t
    ).sort((a, b) => parseDateUTC(b.lastMessage?.created_date) - parseDateUTC(a.lastMessage?.created_date)));
  };

  // Handle ?new=userId from challenge page message button
  useEffect(() => {
    const newUserId = searchParams.get('new');
    if (newUserId && Object.keys(allUsers).length > 0) {
      startConversation(newUserId);
    }
  }, [searchParams, allUsers]);

  // Auto-set active dispute match when thread or disputed matches change
  useEffect(() => {
    if (selectedThread && disputedMatches.length > 0) {
      const dispute = disputedMatches.find(m =>
        m.player1_id === selectedThread.otherId || m.player2_id === selectedThread.otherId
      );
      setActiveDisputeMatch(dispute || null);
    } else {
      setActiveDisputeMatch(null);
    }
  }, [selectedThread, disputedMatches]);

  // Auto-set active schedule challenge when thread or accepted challenges change
  useEffect(() => {
    if (selectedThread && acceptedChallenges.length > 0) {
      const challenge = acceptedChallenges.find(c =>
        c.challenger_id === selectedThread.otherId || c.opponent_id === selectedThread.otherId
      );
      setActiveScheduleChallenge(challenge || null);
    } else {
      setActiveScheduleChallenge(null);
    }
  }, [selectedThread, acceptedChallenges]);

  // Handle ?dispute=<matchId> from dispute flow
  useEffect(() => {
    const disputeMatchId = searchParams.get('dispute');
    if (disputeMatchId && disputedMatches.length > 0 && user && !selectedThread) {
      const match = disputedMatches.find(m => m.id === disputeMatchId);
      if (match) {
        const otherId = match.player1_id === user.id ? match.player2_id : match.player1_id;
        const existing = threads.find(t => t.otherId === otherId);
        if (existing) {
          openThread(existing);
        } else {
          setSelectedThread({ otherId, messages: [], lastMessage: null, unreadCount: 0 });
          setThreadMessages([]);
        }
      }
    }
  }, [searchParams, disputedMatches, threads, user, selectedThread]);

  const startConversation = (otherId) => {
    setShowNewConvo(false);
    setNewConvoSearch('');
    // Check if thread already exists
    const existing = threads.find(t => t.otherId === otherId);
    if (existing) {
      openThread(existing);
    } else {
      // Start a new empty thread
      const newThread = { otherId, messages: [], lastMessage: null, unreadCount: 0 };
      setSelectedThread(newThread);
      setThreadMessages([]);
    }
  };

  const handleProposeScore = async ({ winner_id, score }) => {
    const otherId = selectedThread.otherId;
    const threadId = [user.id, otherId].sort().join('_');

    await supabase.from('matches').update({
      proposed_score: score,
      proposed_winner_id: winner_id,
      proposed_by_id: user.id,
    }).eq('id', activeDisputeMatch.id);

    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: otherId,
      content: `I propose the corrected score: ${score} (Winner: ${getDisplayName(allUsers[winner_id])}). Please review and accept if you agree.`,
      read: false,
      thread_id: threadId,
      match_id: activeDisputeMatch.id,
    });

    await callApi('/api/notify', {
      user_id: otherId,
      type: 'score_submitted',
      title: 'Corrected Score Proposed',
      body: `${getDisplayName(user)} proposed a corrected score for your disputed match. Review and accept if you agree.`,
      related_id: activeDisputeMatch.id,
    });

    setShowProposeScore(false);
    load();
  };

  const handleAcceptScore = async () => {
    const match = activeDisputeMatch;
    const otherId = selectedThread.otherId;
    const threadId = [user.id, otherId].sort().join('_');

    await supabase.from('matches').update({
      status: 'confirmed',
      score: match.proposed_score,
      winner_id: match.proposed_winner_id,
      confirmed_by_id: user.id,
      ranking_updated: true,
    }).eq('id', match.id);

    await updateRankingsForMatch(
      { ...match, winner_id: match.proposed_winner_id },
      match.ladder_id
    );

    await callApi('/api/notify', {
      user_id: otherId,
      type: 'score_confirmed',
      title: 'Score Confirmed',
      body: 'The corrected score has been accepted. Rankings have been updated.',
      related_id: match.id,
    });

    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: otherId,
      content: `I've accepted the corrected score: ${match.proposed_score}. The match is now confirmed.`,
      read: false,
      thread_id: threadId,
      match_id: match.id,
    });

    setActiveDisputeMatch(null);
    load();
  };

  const handleNotifyAdmin = async () => {
    setNotifyingAdmin(true);
    const match = activeDisputeMatch;
    const otherId = selectedThread.otherId;
    const threadId = [user.id, otherId].sort().join('_');

    await supabase.from('matches').update({
      admin_notes: `Escalated to admin by ${getDisplayName(user)}. Players could not agree on the correct score. Original: ${match.score}, Proposed: ${match.proposed_score || 'N/A'}`,
    }).eq('id', match.id);

    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: otherId,
      content: `I've notified the admin to help resolve our score dispute. An admin will review and override the score if needed.`,
      read: false,
      thread_id: threadId,
      match_id: match.id,
    });

    setNotifyingAdmin(false);
    load();
  };

  const handleProposeSchedule = async ({ date, time, location }) => {
    const otherId = selectedThread.otherId;
    const threadId = [user.id, otherId].sort().join('_');

    await supabase.from('challenges').update({
      proposed_date: date,
      proposed_time: time,
      proposed_location: location,
      proposed_by_id: user.id,
      proposal_status: 'proposed',
    }).eq('id', activeScheduleChallenge.id);

    const content = `I propose playing on ${date} at ${time}${location ? ' at ' + location : ''}. Please accept or propose a different time.`;

    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: otherId,
      content,
      read: false,
      thread_id: threadId,
    });

    await callApi('/api/notify', {
      user_id: otherId,
      type: 'challenge_accepted',
      title: 'Match Time Proposed',
      body: `${getDisplayName(user)} proposed a match time: ${date} at ${time}${location ? ' at ' + location : ''}`,
      related_id: activeScheduleChallenge.id,
    });

    setShowProposeSchedule(false);

    // Update local state (no full reload needed)
    const updatedChallenge = { ...activeScheduleChallenge, proposed_date: date, proposed_time: time, proposed_location: location, proposed_by_id: user.id, proposal_status: 'proposed' };
    setActiveScheduleChallenge(updatedChallenge);
    setAcceptedChallenges(prev => prev.map(c => c.id === updatedChallenge.id ? updatedChallenge : c));
    setThreadMessages(prev => [...prev, { content, sender_id: user.id, recipient_id: otherId, created_date: new Date().toISOString(), read: false }]);
  };

  const handleAcceptSchedule = async () => {
    const otherId = selectedThread.otherId;
    const threadId = [user.id, otherId].sort().join('_');
    const c = activeScheduleChallenge;

    await supabase.from('challenges').update({
      proposal_status: 'accepted',
    }).eq('id', c.id);

    const content = `I accept the proposed match time: ${c.proposed_date} at ${c.proposed_time}${c.proposed_location ? ' at ' + c.proposed_location : ''}. See you there!`;

    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: otherId,
      content,
      read: false,
      thread_id: threadId,
    });

    await callApi('/api/notify', {
      user_id: otherId,
      type: 'challenge_accepted',
      title: 'Match Time Confirmed',
      body: `${getDisplayName(user)} accepted the proposed match time: ${c.proposed_date} at ${c.proposed_time}${c.proposed_location ? ' at ' + c.proposed_location : ''}`,
      related_id: c.id,
    });

    // Update local state (no full reload needed)
    const updatedChallenge = { ...c, proposal_status: 'accepted' };
    setActiveScheduleChallenge(updatedChallenge);
    setAcceptedChallenges(prev => prev.map(ch => ch.id === c.id ? updatedChallenge : ch));
    setThreadMessages(prev => [...prev, { content, sender_id: user.id, recipient_id: otherId, created_date: new Date().toISOString(), read: false }]);
  };

  const handleCounterSchedule = () => {
    setScheduleMode('counter');
    setShowProposeSchedule(true);
  };

  const handleNewProposeSchedule = () => {
    setScheduleMode('propose');
    setShowProposeSchedule(true);
  };

  const otherPlayers = Object.values(allUsers).filter(u => u.id !== user?.id);
  const filteredNewConvoPlayers = otherPlayers.filter(p =>
    !newConvoSearch || getDisplayName(p)?.toLowerCase().includes(newConvoSearch.toLowerCase())
  );

  const filteredThreads = threads.filter(t => {
    if (!search) return true;
    const other = allUsers[t.otherId];
    return getDisplayName(other)?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-[calc(100vh-73px)] flex">
      {/* Thread list */}
          <div className={`w-full md:w-80 flex-shrink-0 border-r border-border bg-white flex flex-col ${selectedThread ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h1 className="font-bold text-lg">Messages</h1>
                <Button
                  size="sm"
                  onClick={() => setShowNewConvo(true)}
                  className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filteredThreads.map(thread => {
                const other = allUsers[thread.otherId];
                const isSelected = selectedThread?.otherId === thread.otherId;
                return (
                  <button
                    key={thread.otherId}
                    onClick={() => openThread(thread)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <PlayerAvatar user={other} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm truncate">{getDisplayName(other)}</p>
                        <p className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {thread.lastMessage?.created_date
                            ? formatEasternDate(thread.lastMessage.created_date)
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{thread.lastMessage?.content}</p>
                        {thread.unreadCount > 0 && (
                          <span className="ml-2 flex-shrink-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredThreads.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No conversations yet
                </div>
              )}
            </div>
          </div>

          {/* Message view */}
          <div className={`flex-1 flex flex-col ${!selectedThread ? 'hidden md:flex' : 'flex'}`}>
            {selectedThread ? (
              <>
                <div className="px-6 py-4 border-b border-border bg-white flex items-center gap-3">
                  <button
                    className="md:hidden mr-1 p-1.5 rounded-lg hover:bg-muted"
                    onClick={() => setSelectedThread(null)}
                  >
                    ←
                  </button>
                  <PlayerAvatar user={allUsers[selectedThread.otherId]} size="md" />
                  <div>
                    <p className="font-bold">{getDisplayName(allUsers[selectedThread.otherId])}</p>
                    <p className="text-xs text-muted-foreground">
                      {allUsers[selectedThread.otherId]?.location || 'Player'}
                    </p>
                  </div>
                </div>
                {activeDisputeMatch && (
                  <DisputePanel
                    match={activeDisputeMatch}
                    currentUser={user}
                    allUsers={allUsers}
                    onProposeScore={() => setShowProposeScore(true)}
                    onAcceptScore={handleAcceptScore}
                    onNotifyAdmin={handleNotifyAdmin}
                    notifyingAdmin={notifyingAdmin}
                  />
                )}
                {activeScheduleChallenge && (
                  <MatchSchedulePanel
                    challenge={activeScheduleChallenge}
                    currentUser={user}
                    allUsers={allUsers}
                    onPropose={handleNewProposeSchedule}
                    onAccept={handleAcceptSchedule}
                    onCounter={handleCounterSchedule}
                  />
                )}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
                  {threadMessages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm ${
                            isMe
                              ? 'bg-[hsl(217,72%,16%)] text-white rounded-br-sm'
                              : 'bg-white border border-border rounded-bl-sm'
                          }`}>
                            {msg.content}
                          </div>
                          <p className="text-xs text-muted-foreground px-1">
                            {msg.created_date ? formatEasternTime(msg.created_date) : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-border bg-white">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] px-4"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <div className="text-5xl mb-4">💬</div>
                  <p className="font-semibold text-lg mb-1">Select a conversation</p>
                  <p className="text-muted-foreground text-sm">Choose a player to message from the list</p>
                </div>
              </div>
            )}
          </div>
          {/* New Conversation Modal */}
      <Dialog open={showNewConvo} onOpenChange={setShowNewConvo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={newConvoSearch}
                onChange={e => setNewConvoSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {filteredNewConvoPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No players found</p>
              ) : (
                filteredNewConvoPlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => startConversation(player.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <PlayerAvatar user={player} size="sm" />
                    <div>
                      <p className="font-semibold text-sm">{getDisplayName(player)}</p>
                      {player.location && <p className="text-xs text-muted-foreground">{player.location}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {activeDisputeMatch && (
        <ProposeScoreDialog
          open={showProposeScore}
          onOpenChange={setShowProposeScore}
          players={[
            allUsers[activeDisputeMatch.player1_id],
            allUsers[activeDisputeMatch.player2_id],
          ]}
          currentScore={activeDisputeMatch.score}
          onSubmit={handleProposeScore}
        />
      )}

      {activeScheduleChallenge && (
        <ProposeScheduleDialog
          open={showProposeSchedule}
          onOpenChange={setShowProposeSchedule}
          mode={scheduleMode}
          currentProposal={scheduleMode === 'counter' && activeScheduleChallenge.proposed_date ? {
            date: activeScheduleChallenge.proposed_date,
            time: activeScheduleChallenge.proposed_time,
            location: activeScheduleChallenge.proposed_location,
          } : null}
          onSubmit={handleProposeSchedule}
        />
      )}
    </div>
  );
}