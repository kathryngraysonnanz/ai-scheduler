import * as React from 'react';
import { Button } from "@progress/kendo-react-buttons";
import { Scheduler, WeekView, AgendaView } from '@progress/kendo-react-scheduler';
import { Day } from '@progress/kendo-date-math';
import { Chat } from '@progress/kendo-react-conversational-ui';
import { chat, generateSchedule } from './llm';

import './App.css';

const SYSTEM_PROMPT = `You are a weekly schedule planning assistant. Guide the user through three stages:
1. Non-negotiables (fixed commitments, sleep, meals, recurring appointments)
2. Tasks (work, errands, projects to fit in)
3. Notes (energy levels, preferences, deadlines)
Be concise and warm. When you have enough information, end your message with the exact phrase: "Ready to build your schedule!"`;

const bot = {
  id: 0,
  name: 'bot'
};
const user = {
  id: 1,
  name: 'user'
};
const initialMessages = [{
  id: 1,
  author: bot,
  timestamp: new Date(),
  text: "Let's get started! First, give me a list of your meetings, calls, and other non-negotables."
}];

const App = () => {

  const [messages, setMessages] = React.useState(initialMessages);
  const [llmHistory, setLlmHistory] = React.useState([]);
  const [scheduleData, setScheduleData] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const appendBotMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      author: bot,
      timestamp: new Date(),
      text
    }]);
  };


const addNewMessage = async (event) => {
    const userText = event.message.text || ' ';

    setMessages(prev => [...prev, {
      ...event.message,
      text: userText,
      id: Date.now().toString(),
      author: user
    }]);

    const updatedHistory = [...llmHistory, { role: 'user', content: userText }];
    setLlmHistory(updatedHistory);
    setIsLoading(true);

    try {
      const reply = await chat(updatedHistory, SYSTEM_PROMPT);
      setLlmHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      appendBotMessage(reply);

      // if the model signals it's done gathering, generate the schedule
      if (reply.includes('Ready to build your schedule!')) {
        const events = await generateSchedule(updatedHistory);
        setScheduleData(events);
        console.log(events)
      }
    } catch (e) {
      appendBotMessage(`Something went wrong: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className='flex'>
      <div>
        <Chat 
          messages={messages} 
          authorId={user.id} 
          onSendMessage={addNewMessage} 
           placeholder={isLoading ? 'Waiting for response...' : 'Type a message...'}
          style={{ maxWidth: '100%'}} 
          className="k-m-auto" 
          height={'100vh'} />
      </div>
      <main style={{width: '100%'}}>
        <Scheduler data={scheduleData} style={{minHeight:'100%'}}>
             <AgendaView title="Agenda" step={2} numberOfDays={7} selectedDateFormat={'From: {0:D} To: {1:D}'} selectedShortDateFormat={'From: {0:d} To: {1:d}'} 
            />
            <WeekView title="Full Week" workWeekStart={Day.Monday} workWeekEnd={Day.Thursday} />
        </Scheduler>
      </main>
    </div>
  )
};
export default App;