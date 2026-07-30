export const courseModules = [
  {
    id: 'day-1',
    title: 'Day 01',
    status: 'STUDYING',
    files: [
      {
        id: 'd1-slide-hackathon',
        title: 'd1-slide-hackathon.pdf',
        totalPages: 83,
      },
    ],
  },
  {
    id: 'day-2',
    title: 'Day 02',
    status: '',
    files: [
      {
        id: 'd2-slide-hackathon',
        title: 'd2-slide-hackathon.pdf',
        totalPages: 64,
      },
    ],
  },
  {
    id: 'day-3',
    title: 'Day 03',
    status: '',
    files: [
      {
        id: 'day03-tu-chatbot',
        title: 'day03-tu-chatbot-den-agentic-agent-react-v7.pdf',
        totalPages: 40,
      },
    ],
  },
  {
    id: 'day-4',
    title: 'Day 04',
    status: '',
    files: [
      {
        id: 'day04-prompt-engineering',
        title: 'day04-prompt-engineering-tool-calling.pdf',
        totalPages: 50,
      },
    ],
  },
];

export const defaultFile = courseModules[0].files[0];
