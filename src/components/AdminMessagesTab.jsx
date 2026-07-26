import { useState, useEffect, useRef } from 'react';
import { supabase, callApi } from '@/lib/supabaseClient';
import { Megaphone, Send, Edit, Trash2, Search, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  const [msgRecipient, setMsgRecipient] = useState('all');
  const [msgContent, setMsgContent] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const [editingAnn, setEditingAnn] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Conversations (multi-thread admin inbox)
  const [threads, setThreads] = useState([]);
  const [selectedOtherId, setSelectedOtherId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [convoSearch, setConvoSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (propLadderId) setLadderId(propLadderId);
  }, [propLadderId]);

  useEffect(() => {
    if (user && ladderId) loadData();
    else if (user && !propLadderId) load();
  }, [user, ladderId]);

  useEffect(() => {
    if (user) loadThreads();
  }, [user]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    }, 50);
  }, [threadMessages, selectedOtherId]);

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

  const sendMessage = async () => {
    if (!msgContent.trim()) return;
    setSendingMsg(true);

    const recipients = msgRecipient === 'all'
      ? members
      : members.filter(m => m.user_id === msgRecipient);

    const messages = recipients.map(mem => ({
      sender_id: user.id,
      recipient_id: mem.user_id,
      content: msgContent.trim(),
      read: false,
      thread_id: [user.id, mem.user_id].sort().join('_'),
    }));

    const notifs = recipients.map(mem => ({
      user_id: mem.user_id,
      type: 'new_message',
      title: 'Message from Admin',
      body: msgContent.trim().slice(0, 100),
    }));

    try {
      await supabase.from('messages').insert(messages);
      await callApi('/api/notify', { notifications: notifs });
    } catch (err) {
      console.warn('Admin message failed:', err?.message);
    }

    setMsgContent('');
    setMsgRecipient('all');
    setSendingMsg(false);
    loadThreads();
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
    })).sort((a, b) => parseDateUTC(b.lastMessage?.created_date) - parseDateUTC(a.lastMessage?.created_date));

    setThreads(threadList);
  };

  const openThread = async (thread) => {
    setSelectedOtherId(thread.otherId);
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

  const startConversation = (otherId) => {
    setShowNewConvo(false);
    setNewConvoSearch('');
    const existing = threads.find(t => t.otherId === otherId);
    if (existing) {
      openThread(existing);
    } else {
      setSelectedOtherId(otherId);
      setThreadMessages([]);
    }
  };

  const sendReply = async () => {
    if (!newMessage.trim() || !selectedOtherId) return;
    setSendingReply(true);

    const { data: msg } = await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: selectedOtherId,
      content: newMessage.trim(),
      read: false,
      thread_id: [user.id, selectedOtherId].sort().join('_'),
    }).select().single();

    try {
      await callApi('/api/notify', {
        user_id: selectedOtherId,
        type: 'new_message',
        title: 'Message from Admin',
        body: newMessage.trim().slice(0, 100),
      });
    } catch (err) {
      console.warn('Admin reply notify failed:', err?.message);
    }

    setNewMessage('');
    setSendingReply(false);

    const newMsg = { ...msg, created_date: msg?.created_date || new Date().toISOString() };
    const updated = [...threadMessages, newMsg];
    setThreadMessages(updated);
    setThreads(prev => {
      const exists = prev.find(t => t.otherId === selectedOtherId);
      const next = exists
        ? prev.map(t => t.otherId === selectedOtherId ? { ...t, messages: updated, lastMessage: newMsg } : t)
        : [...prev, { otherId: selectedOtherId, messages: updated, lastMessage: newMsg, unreadCount: 0 }];
      return next.sort((a, b) => parseDateUTC(b.lastMessage?.created_date) - parseDateUTC(a.lastMessage?.created_date));
    });
  };

  const memberMap = {};
  members.forEach(m => { memberMap[m.user_id] = m; });
  const getOther = (otherId) => {
    const mem = memberMap[otherId];
    return mem ? { id: otherId, full_name: mem.display_name, avatar_url: mem.avatar_url, location: mem.location } : { id: otherId };
  };

  const filteredThreads = threads.filter(t => {
    if (!convoSearch) return true;
    return getDisplayName(getOther(t.otherId))?.toLowerCase().includes(convoSearch.toLowerCase());
  });

  const threadPartnerIds = new Set(threads.map(t => t.otherId));
  const filteredNewConvoMembers = members
    .filter(m => !threadPartnerIds.has(m.user_id))
    .filter(m => !newConvoSearch || m.display_name?.toLowerCase().includes(newConvoSearch.toLowerCase()));

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

      {/* Send Message */}
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-[hsl(217,72%,40%)]" />
          Send Message
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Recipient</label>
            <Select value={msgRecipient} onValueChange={setMsgRecipient}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Active Players</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Type your message..."
            value={msgContent}
            onChange={e => setMsgContent(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              onClick={sendMessage}
              disabled={!msgContent.trim() || sendingMsg}
              className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2"
            >
              <Send className="w-4 h-4" />
              {sendingMsg ? 'Sending...' : `Send${msgRecipient === 'all' ? ' to All' : ''}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Conversations */}
      <div className="bg-white rounded-xl border border-border shadow-sm mt-6 overflow-hidden">
        <div className="flex h-[600px]">
          {/* Thread list */}
          <div className={`w-full md:w-72 flex-shrink-0 border-r border-border flex flex-col ${selectedOtherId ? 'hidden md:flex' : 'flex'}`}>
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
              {filteredThreads.map(thread => {
                const other = getOther(thread.otherId);
                const isSelected = selectedOtherId === thread.otherId;
                return (
                  <button
                    key={thread.otherId}
                    onClick={() => openThread(thread)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <PlayerAvatar user={other} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm truncate">{getDisplayName(other)}</p>
                        {thread.lastMessage?.created_date && (
                          <p className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            {formatEasternDate(thread.lastMessage.created_date)}
                          </p>
                        )}
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

          {/* Thread view */}
          <div className={`flex-1 flex flex-col ${!selectedOtherId ? 'hidden md:flex' : 'flex'}`}>
            {selectedOtherId ? (
              <>
                <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                  <button
                    className="md:hidden mr-1 p-1.5 rounded-lg hover:bg-muted"
                    onClick={() => setSelectedOtherId(null)}
                  >
                    ←
                  </button>
                  <PlayerAvatar user={getOther(selectedOtherId)} size="sm" />
                  <p className="font-bold text-sm">{getDisplayName(getOther(selectedOtherId))}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">
                  {threadMessages.map(msg => {
                    const isMe = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
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
              {filteredNewConvoMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No players found</p>
              ) : (
                filteredNewConvoMembers.map(m => (
                  <button
                    key={m.user_id}
                    onClick={() => startConversation(m.user_id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <PlayerAvatar user={getOther(m.user_id)} size="sm" />
                    <p className="font-semibold text-sm">{m.display_name}</p>
                  </button>
                ))
              )}
            </div>
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