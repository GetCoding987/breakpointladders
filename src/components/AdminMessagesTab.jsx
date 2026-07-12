import { useState, useEffect } from 'react';
import { supabase, callApi } from '@/lib/supabaseClient';
import { Megaphone, Send, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatEasternDateTime } from '@/utils/easternTime';

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

  useEffect(() => {
    if (propLadderId) setLadderId(propLadderId);
  }, [propLadderId]);

  useEffect(() => {
    if (user && ladderId) loadData();
    else if (user && !propLadderId) load();
  }, [user, ladderId]);

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
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
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