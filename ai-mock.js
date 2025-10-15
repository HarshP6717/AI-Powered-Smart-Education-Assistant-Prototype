/* Mock AI functions to generate quizzes, flashcards, cheat sheets and recommendations.
   These are deterministic-ish and run offline for demo purposes.
*/
(function(){
  function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

  const AI = {
    generateFlashcards(subject, count=6){
      const cards = [];
      for(let i=1;i<=count;i++){
        cards.push({
          id: uid('fc'),
          subjectId: subject.id || subject,
          question: `${subject.name || subject} - Concept ${i}`,
          answer: `Explanation for ${subject.name || subject} Concept ${i}`,
          ease: 2.5,
          interval: 1,
          reviews: 0,
          nextReview: Date.now()
        });
      }
      return cards;
    },

    generateQuiz(subject, num=5){
      const subjId = subject.id || subject;
      const name = subject.name || subject;
      const q = { id: uid('qz'), subjectId: subjId, title: `${name} Quick Quiz`, questions: [] };

      // Preloaded demo questions for known demo subjects
      const demoSets = {
        's1': [
          { text: 'What is the derivative of x^2?', options:['2x','x','x^2','1'], answer:'2x', explanation:'Power rule' },
          { text: 'The derivative represents:', options:['Rate of change','Area under curve','Sum of series','Integral'], answer:'Rate of change', explanation:'Definition' },
          { text: 'd/dx sin(x) equals:', options:['cos(x)','-cos(x)','sin(x)','-sin(x)'], answer:'cos(x)', explanation:'Trigonometric derivative' },
          { text: 'Power rule: d/dx x^n =', options:['n*x^(n-1)','x^n','n*x','(n-1)*x^n'], answer:'n*x^(n-1)', explanation:'Power rule formula' },
          { text: 'Chain rule applies when:', options:['Nesting of functions','Adding functions','Constant functions','Linear functions'], answer:'Nesting of functions', explanation:'Composition of functions' }
        ],
        's2': [
          { text: 'Which data structure uses LIFO?', options:['Stack','Queue','Tree','Graph'], answer:'Stack', explanation:'Stack is LIFO' },
          { text: 'A binary tree node can have how many children?', options:['0,1 or 2','Only 2','Only 1','3'], answer:'0,1 or 2', explanation:'Binary tree definition' },
          { text: 'Which traversal is root-left-right?', options:['Preorder','Inorder','Postorder','Level-order'], answer:'Preorder', explanation:'Traversal order' },
          { text: 'Hash table average lookup time is', options:['O(1)','O(n)','O(log n)','O(n log n)'], answer:'O(1)', explanation:'Hashing average case' },
          { text: 'Which data structure is best for FIFO?', options:['Queue','Stack','Set','Map'], answer:'Queue', explanation:'Queue is FIFO' }
        ]
      };

      const demo = demoSets[subjId] || demoSets[name.toLowerCase()] || null;
      if(demo){
        // Use demo set but allow user-requested size
        for(let i=0;i<Math.min(num, demo.length); i++){
          const d = demo[i]; q.questions.push(Object.assign({ id: uid('q') }, d));
        }
        // if requested more than demo length, pad with generic items
        for(let i=q.questions.length;i<num;i++){
          q.questions.push({ id: uid('q'), text: `${name} question ${i+1}`, options:['A','B','C','D'], answer:'A', explanation:'Generated question' });
        }
        return q;
      }

      // fallback generic generator
      for(let i=1;i<=num;i++){
        q.questions.push({ id: uid('q'), text: `${name} question ${i}`, options: ['A','B','C','D'], answer: 'A', explanation: 'Because of fundamentals.' });
      }
      return q;
    },

    generateCheatsheet(subject){
      return { id: uid('cs'), subjectId: subject.id || subject, title: `${subject.name || subject} Cheat Sheet`, content: `Key formulas and tips for ${(subject.name||subject)}...\n\n1) Important formula\n2) Quick examples\n3) Tips and tricks` };
    },

    recommendStudyPlan(user, subjects){
      // simple weighted by subject list order
      const plan = { id: uid('plan'), userId: user.id, created: Date.now(), items: [] };
      const total = subjects.length || 1;
      subjects.forEach((s, idx) => {
        plan.items.push({ subjectId: s.id, percent: Math.max(10, Math.round(100 * ((total - idx) / (total*(total+1)/2)))) });
      });
      return plan;
    }
  };

  // Small SM-2 hint generator for scheduling suggestions
  AI.sm2 = function(card, quality){
    // quality 0-5
    card.reviews = (card.reviews||0) + 1;
    if(card.reviews === 1){ card.interval = 1; card.ease = 2.5; }
    else if(card.reviews === 2){ card.interval = 6; }
    else { card.interval = Math.round(card.interval * (card.ease)); }
    // adjust ease
    card.ease = Math.max(1.3, card.ease + (0.1 - (5-quality)*0.08));
    card.nextReview = Date.now() + card.interval * 24*3600*1000;
    return card;
  };

  window.AI = AI;
})();
