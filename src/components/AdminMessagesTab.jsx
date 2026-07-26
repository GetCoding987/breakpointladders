import { useState, useEffect, useRef } from 'react';
import { supabase, callApi } from '@/lib/supabaseClient';
import { Megaphone, Send, Edit, Trash2, Search, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import PlayerAvatar from '@/components/PlayerAvatar';
import { getDisplayName } from '@/utils/userHelpers';
import { formatEasternDateTime, formatEasternTime, formatEasternDate, parseDateUTC } from '@/utils/easternTime';

export default function AdminMessagesTab({ user, ladderId: propLadderId }) {
  const [ladderId, setLadderId] = useState(propLadderId || null);
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  const [editingAnn, setEditingAnn] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Conversations (multi-thread admin inbox: 1:1 threads + group conversations)
  const [threads, setThreads] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null); // { type: 'dm', key: otherId } | { type: 'group', key: conversationId }
  const [threadMessages, setThreadMessages] = useState([]);
  const [convoSearch, setConvoSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingConvo, setCreatingConvo] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (propLadderId) setLadderId(propLadderId);
  }, [propLadderId]);

  useEffect(() => {
    if (user && ladderId) loadData();
    else if (user && !propLadderId) load();
  }, [user, ladderId]);

  useEffect(() => {
    if (user) {
      loadThreads();
      loadGroups();
    }
  }, [user]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    }, 50);
  }, [threadMessages, selected]);

  const load = async () => {
    const { data: myMems } = await supabase.from('ladder_memberships').select('*').match({ user_id: user.id });
    if (!myMems || myMems.length === 0) return;
    const lid = myMems[0].ladder_id;
    setLadderId(lid);
    loadData(lid);
  };

  const loadData = async (lid = ladderId) => {
    if (!lid) return;
    const { data: allMems } = await supabase.from('ladder_memberships').select('*').match({ ladder_id: lid });
    setMembers((allMems || []).filter(m => m.status === 'active' && m.user_id !== user.id));

    const { data: anns } = await supabase.from('announcements').select('*').match({ ladder_id: lid });
    setAnnouncements((anns || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
  };

  const postAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim() || !ladderId) return;
    setPostingAnn(true);
    await supabase.from('announcements').insert({
      title: annTitle.trim(),
      body: annBody.trim(),
      ladder_id: ladderId,
    });
    setAnnTitle('');
    setAnnBody('');
    setPostingAnn(false);
    loadData();
  };

  const openEdit = (ann) => {
    setEditingAnn(ann);
    setEditTitle(ann.title);
    setEditBody(ann.body);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editBody.trim()) return;
    setSavingEdit(true);
    await supabase.from('announcements').update({
      title: editTitle.trim(),
      body: editBody.trim(),
    }).eq('id', editingAnn.id);
    setSavingEdit(false);
    setEditingAnn(null);
    setEditTitle('');
    setEditBody('');
    loadData();
  };

  const deleteAnnouncement = async (ann) => {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('announcements').delete().eq('id', ann.id);
    loadData();
  };

  const loadThreads = async () => {
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('messages').select('*').match({ sender_id: user.id }),
      supabase.from('messages').select('*').match({ recipient_id: user.id }),
    ]);

    const allMsgs = [...(sent || []), ...(received || [])];
    const threadMap = {};
    allMsgs.forEach(msg => {
      const otherId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      if (!threadMap[otherId]) threadMap[otherId] = [];
      threadMap[otherId].push(msg);
    });

    const threadList = Object.entries(threadMap).map(([otherId, msgs]) => ({
      otherId,
      messages: msgs.sort((a, b) => parseDateUTC(a.created_date) - parseDateUTC(b.created_date)),
      lastMessage: msgs.sort((a, b) => parseDateUTC(b.created_date) - parseDateUTC(a.created_date))[0],
      unreadCount: msgs.filter(m => m.recipient_id === user.id && !m.read).length,
    }));

    setThreads(threadList);
  };

  const loadGroups = async () => {
    const { data: myParticipant } = await supabase.from('conversation_participants').select('conversation_id').match({ user_id: user.id });
    const convoIds = (myParticipant || []).map(p => p.conversation_id);
    if (convoIds.length === 0) {
      setGroups([]);
      return;
    }

    const [{ data: convos }, { data: allParticipants }, { data: msgs }] = await Promise.all([
      supabase.from('conversations').select('*').in('id', convoIds),
      supabase.from('conversation_participants').select('*').in('conversation_id', convoIds),
      supabase.from('conversation_messages').select('*').in('conversation_id', convoIds),
    ]);

    const groupList = (convos || []).map(c => {
      const participantIds = (allParticipants || [])
        .filter(p => p.conversation_id === c.id)
        .map(p => p.user_id)
        .filter(id => id !== user.id);
      const messages = (msgs || [])
        .filter(m => m.conversation_id === c.id)
        .sort((a, b) => parseDateUTC(a.created_date) - parseDateUTC(b.created_date));
      return {
        id: c.id,
        name: c.name,
        participantIds,
        messages,
        lastMessage: messages[messages.length - 1] || null,
      };
    });

    setGroups(groupList);
  };

  const openThread = async (thread) => {
    setSelected({ type: 'dm', key: thread.otherId });
    setThreadMessages(thread.messages);

    const unread = thread.messages.filter(m => m.recipient_id === user.id && !m.read);
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

  const openGroup = (group) => {
    setSelected({ type: 'group', key: group.id });
    setThreadMessages(group.messages);
  };

  const startConversation = (otherId) => {
    const existing = threads.find(t => t.otherId === otherId);
    if (existing) {
      openThread(existing);
    } else {
      setSelected({ type: 'dm', key: otherId });
      setThreadMessages([]);
    }
  };

  const createGroupOrDM = async () => {
    const ids = Array.from(selectedMemberIds);
    if (ids.length === 0) return;

    if (ids.length === 1) {
      startConversation(ids[0]);
      closeNewConvo();
      return;
    }

    setCreatingConvo(true);
    const { data: convo, error } = await supabase
      .from('conversations')
      .insert({ name: newGroupName.trim() || null, created_by: user.id })
      .select()
      .single();

    if (error) {
      console.error('Failed to create group conversation:', error.message);
      setCreatingConvo(false);
      return;
    }

    const participantRows = [user.id, ...ids].map(uid => ({ conversation_id: convo.id, user_id: uid }));
    await supabase.from('conversation_participants').insert(participantRows);

    const newGroup = { id: convo.id, name: convo.name, participantIds: ids, messages: [], lastMessage: null };
    setGroups(prev => [newGroup, ...prev]);
    setSelected({ type: 'group', key: convo.id });
    setThreadMessages([]);
    setCreatingConvo(false);
    closeNewConvo();
  };

  const closeNewConvo = () => {
    setShowNewConvo(false);
    setNewConvoSearch('');
    setSelectedMemberIds(new Set());
    setNewGroupName('');
  };

  const toggleMemberSelected = (userId) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const sendReply = async () => {
    if (!newMessage.trim() || !selected) return;
    setSendingReply(true);

    if (selected.type === 'dm') {
      const otherId = selected.key;
      const { data: msg } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: otherId,
        content: newMessage.trim(),
        read: false,
        thread_id: [user.id, otherId].sort().join('_'),
      }).select().single();

      try {
        await callApi('/api/notify', {
          user_id: otherId,
          type: 'new_message',
          title: 'Message from Admin',
          body: newMessage.trim().slice(0, 100),
        });
      } catch (err) {
        console.warn('Admin reply notify failed:', err?.message);
      }

      const newMsg = { ...msg, created_date: msg?.created_date || new Date().toISOString() };
      const updated = [...threadMessages, newMsg];
      setThreadMessages(updated);
      setThreads(prev => {
        const exists = prev.find(t => t.otherId === otherId);
        return exists
          ? prev.map(t => t.otherId === otherId ? { ...t, messages: updated, lastMessage: newMsg } : t)
          : [...prev, { otherId, messages: updated, lastMessage: newMsg, unreadCount: 0 }];
      });
    } else {
      const conversationId = selected.key;
      const { data: msg } = await supabase.from('conversation_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim(),
      }).select().single();

      const group = groups.find(g => g.id === conversationId);
      const notifs = (group?.participantIds || []).map(uid => ({
        user_id: uid,
        type: 'new_message',
        title: 'New group message from Admin',
        body: newMessage.trim().slice(0, 100),
      }));
      try {
        await callApi('/api/notify', { notifications: notifs });
      } catch (err) {
        console.warn('Admin group reply notify failed:', err?.message);
      }

      const newMsg = { ...msg, created_date: msg?.created_date || new Date().toISOString() };
      const updated = [...threadMessages, newMsg];
      setThreadMessages(updated);
      setGroups(prev => prev.map(g => g.id === conversationId ? { ...g, messages: updated, lastMessage: newMsg } : g));
    }

    setNewMessage('');
    setSendingReply(false);
  };

  const memberMap = {};
  members.forEach(m => { memberMap[m.user_id] = m; });
  const getOther = (otherId) => {
    const mem = memberMap[otherId];
    return mem ? { id: otherId, full_name: mem.display_name, avatar_url: mem.avatar_url, location: mem.location } : { id: otherId };
  };

  const getGroupName = (group) => {
    if (group.name) return group.name;
    const names = group.participantIds.map(id => getDisplayName(getOther(id)));
    return names.join(', ') || 'Group';
  };

  // Unified, chronologically-sorted list of 1:1 threads and group conversations
  const unifiedThreads = [
    ...threads.map(t => ({ type: 'dm', key: t.otherId, lastMessage: t.lastMessage, unreadCount: t.unreadCount, raw: t })),
    ...groups.map(g => ({ type: 'group', key: g.id, lastMessage: g.lastMessage, unreadCount: 0, raw: g })),
  ].sort((a, b) => parseDateUTC(b.lastMessage?.created_date) - parseDateUTC(a.lastMessage?.created_date));

  const filteredUnifiedThreads = unifiedThreads.filter(t => {
    if (!convoSearch) return true;
    const name = t.type === 'dm' ? getDisplayName(getOther(t.key)) : getGroupName(t.raw);
    return name?.toLowerCase().includes(convoSearch.toLowerCase());
  });

  const filteredNewConvoMembers = members
    .filter(m => !newConvoSearch || m.display_name?.toLowerCase().includes(newConvoSearch.toLowerCase()));

  const selectedGroup = selected?.type === 'group' ? groups.find(g => g.id === selected.key) : null;
  const selectedDmOther = selected?.type === 'dm' ? getOther(selected.key) : null;

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* Post Announcement */}
      <div className="bg-white rounded-xl border border-border p-5 mb-6 shadow-sm">
        <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[hsl(217,72%,40%)]" />
          Post Announcement
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Announcements appear on all players' dashboards.</p>
        <div className="space-y-3">
          <Input
            placeholder="Announcement title..."
            value={annTitle}
            onChange={e => setAnnTitle(e.target.value)}
          />
          <Textarea
            placeholder="Write your announcement..."
            value={annBody}
            onChange={e => setAnnBody(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              onClick={postAnnouncement}
              disabled={!annTitle.trim() || !annBody.trim() || postingAnn}
              className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2"
            >
              <Megaphone className="w-4 h-4" />
              {postingAnn ? 'Posting...' : 'Post Announcement'}
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5 mb-6 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground mb-4">Recent Announcements</p>
          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{ann.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{ann.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ann.created_date ? formatEasternDateTime(ann.created_date) : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(ann)} className="h-7 w-7">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteAnnouncement(ann)} className="h-7 w-7 text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      <div className="bg-white rounded-xl border border-border shadow-sm mt-6 overflow-hidden">
        <div className="flex h-[600px]">
          {/* Thread list */}
          <div className={`w-full md:w-72 flex-shrink-0 border-r border-border flex flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[hsl(217,72%,40%)]" />
                  Conversations
                </h2>
                <Button size="sm" onClick={() => setShowNewConvo(true)} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]">
                  New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={convoSearch}
                  onChange={e => setConvoSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filteredUnifiedThreads.map(t => {
                const isSelected = selected?.type === t.type && selected?.key === t.key;
                const isGroup = t.type === 'group';
                const name = isGroup ? getGroupName(t.raw) : getDisplayName(getOther(t.key));
                return (
                  <button
                    key={`${t.type}-${t.key}`}
                    onClick={() => isGroup ? openGroup(t.raw) : openThread(t.raw)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {isGroup ? (
                      <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <PlayerAvatar user={getOther(t.key)} size="sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm truncate">{name}</p>
                        {t.lastMessage?.created_date && (
                          <p className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            {formatEasternDate(t.lastMessage.created_date)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{t.lastMessage?.content}</p>
                        {t.unreadCount > 0 && (
                          <span className="ml-2 flex-shrink-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredUnifiedThreads.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No conversations yet
                </div>
              )}
            </div>
          </div>

          {/* Thread view */}
          <div className={`flex-1 flex flex-col ${!selected ? 'hidden md:flex' : 'flex'}`}>
            {selected ? (
              <>
                <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                  <button
                    className="md:hidden mr-1 p-1.5 rounded-lg hover:bg-muted"
                    onClick={() => setSelected(null)}
                  >
                    ←
                  </button>
                  {selected.type === 'group' ? (
                    <>
                      <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <p className="font-bold text-sm">{selectedGroup ? getGroupName(selectedGroup) : ''}</p>
                    </>
                  ) : (
                    <>
                      <PlayerAvatar user={selectedDmOther} size="sm" />
                      <p className="font-bold text-sm">{getDisplayName(selectedDmOther)}</p>
                    </>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">
                  {threadMessages.map(msg => {
                    const isMe = msg.sender_id === user.id;
                    const senderName = selected.type === 'group' && !isMe
                      ? getDisplayName(getOther(msg.sender_id))
                      : null;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          {senderName && (
                            <p className="text-xs font-semibold text-muted-foreground px-1">{senderName}</p>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl text-sm ${
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
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendReply}
                      disabled={!newMessage.trim() || sendingReply}
                      className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] px-3"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <p className="font-semibold mb-1">Select a conversation</p>
                  <p className="text-muted-foreground text-sm">Choose a player to view or reply</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Conversation Modal */}
      <Dialog open={showNewConvo} onOpenChange={(open) => open ? setShowNewConvo(true) : closeNewConvo()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              Select one player for a 1:1 chat, or 2+ for a group chat everyone can see.
            </p>
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
            <div className="max-h-56 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {filteredNewConvoMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No players found</p>
              ) : (
                filteredNewConvoMembers.map(m => (
                  <label
                    key={m.user_id}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMemberIds.has(m.user_id)}
                      onCheckedChange={() => toggleMemberSelected(m.user_id)}
                    />
                    <PlayerAvatar user={getOther(m.user_id)} size="sm" />
                    <p className="font-semibold text-sm">{m.display_name}</p>
                  </label>
                ))
              )}
            </div>
            {selectedMemberIds.size >= 2 && (
              <Input
                placeholder="Group name (optional)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              />
            )}
            <Button
              onClick={createGroupOrDM}
              disabled={selectedMemberIds.size === 0 || creatingConvo}
              className="w-full bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]"
            >
              {creatingConvo
                ? 'Starting...'
                : selectedMemberIds.size >= 2
                  ? `Start Group (${selectedMemberIds.size})`
                  : 'Start Conversation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Announcement Dialog */}
      <Dialog open={!!editingAnn} onOpenChange={() => setEditingAnn(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Title..."
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
            <Textarea
              placeholder="Body..."
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setEditingAnn(null)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={!editTitle.trim() || !editBody.trim() || savingEdit} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]">
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
