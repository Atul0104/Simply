import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Search, Check, HelpCircle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const faqs = [
  {
    question: 'Where is my order?',
    answer: 'You can track your order by going to My Orders section in your profile. Each order has a tracking number and real-time status updates.'
  },
  {
    question: 'How do I return a product?',
    answer: 'To return a product, go to your order details and click on Return Item. Our team will guide you through the return process. Returns are accepted within 7 days of delivery.'
  },
  {
    question: 'How do I cancel my order?',
    answer: 'You can cancel your order before it is shipped. Go to My Orders, select the order, and click Cancel Order. Refund will be processed within 5-7 business days.'
  },
  {
    question: 'Payment failed - what do I do?',
    answer: 'If your payment failed, please check your payment details and try again. Make sure you have sufficient balance and your card is enabled for online transactions. Contact your bank if the issue persists.'
  },
  {
    question: 'How long does delivery take?',
    answer: 'Standard delivery takes 5-7 business days. Express delivery (where available) takes 2-3 business days. You will receive tracking updates via email and SMS.'
  },
  {
    question: 'Do you offer cash on delivery?',
    answer: 'Yes, cash on delivery is available for orders under Rs 50,000. A small COD charge may apply depending on your location.'
  },
  {
    question: 'How do I contact the seller?',
    answer: 'You can contact the seller through the Contact Seller button on the product page or in your order details after purchase.'
  },
  {
    question: 'What is your refund policy?',
    answer: 'Refunds are processed within 5-7 business days after we receive the returned item. The amount will be credited to your original payment method.'
  }
];

export default function SupportCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketData, setTicketData] = useState({ subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to raise a support ticket');
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/support/tickets`, ticketData);
      setTicketSubmitted(true);
      toast.success('Support ticket submitted successfully!');
      setTicketData({ subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Button>
        
        <div className="text-center mb-8">
          <HelpCircle className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-4xl font-bold mb-2">How can we help you?</h1>
          <p className="text-gray-600">Search for answers or raise a support ticket</p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search for help topics..."
                className="pl-10 h-12 text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-help"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFaqs.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No matching FAQs found</p>
            ) : (
              <Accordion type="single" collapsible>
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-700">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Still need help? Raise a Support Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            {ticketSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Ticket Submitted Successfully!</h3>
                <p className="text-gray-600 mb-4">
                  Our support team will get back to you within 24 hours.
                </p>
                <Button onClick={() => setTicketSubmitted(false)} variant="outline">
                  Submit Another Ticket
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={ticketData.subject}
                    onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
                    required
                    placeholder="Brief description of your issue"
                    data-testid="ticket-subject"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={ticketData.message}
                    onChange={(e) => setTicketData({ ...ticketData, message: e.target.value })}
                    required
                    placeholder="Describe your issue in detail..."
                    rows={6}
                    data-testid="ticket-message"
                  />
                </div>

                {!user && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                    Please login to submit a support ticket
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !user}
                  className="w-full"
                  data-testid="submit-ticket-btn"
                >
                  {loading ? 'Submitting...' : 'Submit Ticket'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Other Ways to Reach Us</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium mb-1">Email</p>
                <p className="text-gray-600">support@marketplace.com</p>
              </div>
              <div>
                <p className="font-medium mb-1">Phone</p>
                <p className="text-gray-600">+91 99999 99999</p>
              </div>
              <div>
                <p className="font-medium mb-1">Hours</p>
                <p className="text-gray-600">Mon-Sat: 9 AM - 6 PM</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
