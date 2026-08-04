import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Ticket, MessageSquare, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function TicketManagement() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responses, setResponses] = useState([]);
  const [responseMessage, setResponseMessage] = useState('');

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    try {
      const url = filter === 'all' ? `${API_URL}/admin/tickets` : `${API_URL}/admin/tickets?status=${filter}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data);
    } catch (error) {
      toast.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (ticketId) => {
    try {
      const response = await axios.get(`${API_URL}/tickets/${ticketId}/responses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResponses(response.data);
    } catch (error) {
      toast.error('Failed to fetch responses');
    }
  };

  const handleStatusUpdate = async (ticketId, status) => {
    try {
      await axios.put(
        `${API_URL}/admin/tickets/${ticketId}/status`,
        null,
        {
          params: { status },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Status updated');
      fetchTickets();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleResponse = async () => {
    if (!responseMessage.trim()) return;

    try {
      await axios.post(
        `${API_URL}/admin/tickets/${selectedTicket.id}/respond`,
        null,
        {
          params: { message: responseMessage },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Response sent');
      setResponseMessage('');
      fetchResponses(selectedTicket.id);
      fetchTickets();
    } catch (error) {
      toast.error('Failed to send response');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ticket Management</h1>
          <p className="text-gray-500 mt-1">Manage customer support tickets</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {tickets.map((ticket) => (
          <Card key={ticket.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="w-5 h-5 text-blue-500" />
                  <div>
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <p className="text-sm text-gray-500">{ticket.customer_name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className={getPriorityColor(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                  <Badge className={getStatusColor(ticket.status)}>
                    {ticket.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-700">{ticket.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Category: {ticket.category} | Created: {format(new Date(ticket.created_at), 'PPp')}
                </p>
              </div>

              <div className="flex gap-2">
                <Select
                  value={ticket.status}
                  onValueChange={(value) => handleStatusUpdate(ticket.id, value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        fetchResponses(ticket.id);
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      View & Respond
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Ticket Responses</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {responses.map((resp) => (
                        <div key={resp.id} className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-sm">{resp.responder_name}</p>
                          <p className="text-sm mt-1">{resp.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(resp.created_at), 'PPp')}
                          </p>
                        </div>
                      ))}

                      <div className="space-y-2">
                        <Textarea
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="Type your response..."
                          rows={3}
                        />
                        <Button onClick={handleResponse} className="w-full">
                          Send Response
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tickets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">No tickets found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
