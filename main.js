/* Main application wiring for the demo SPA. Uses DB and AI mocks. */
(function(){
  function el(q, ctx=document) { return ctx.querySelector(q); }
  function els(q, ctx=document) { return Array.from(ctx.querySelectorAll(q)); }

  const App = {
    state: {},
    init(){
      this.bindNav();
      this.renderView('dashboard');
      this.populateCoins();
      this.bindLanguage();
      this.bindOfflineToggle();
      this.bindGlobalSignOut();
    },

    bindNav(){
      document.querySelectorAll('.nav-btn').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          const v = btn.dataset.view;
          this.renderView(v);
        });
      });
    },

    renderView(name){
      const root = el('#view-root');
      if(!root) return console.warn('No #view-root found');
      root.innerHTML = '';
      if(name === 'dashboard') return root.appendChild(this.renderDashboard());
      if(name === 'subjects') return root.appendChild(this.renderSubjects());
      if(name === 'study') return root.appendChild(this.renderStudy());
    if(name === 'ai') return root.appendChild(this.renderAiTutor());
      if(name === 'flashcards') return root.appendChild(this.renderFlashcards());
      if(name === 'quizzes') return root.appendChild(this.renderQuizzes());
      if(name === 'store') return root.appendChild(this.renderStore());
      if(name === 'leaderboard') return root.appendChild(this.renderLeaderboard());
      if(name === 'settings') return root.appendChild(this.renderSettings());
      root.innerHTML = '<div class="p-6">Unknown View</div>';
    },

    renderDashboard(){
      const wrap = document.createElement('div');
      wrap.className = 'p-6';
      const s = DB.subjects.list();
      const user = DB.users.list()[0] || {name:'Student'};
      wrap.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white p-6 rounded-xl card-shadow">
            <h2 class="text-lg font-semibold mb-2">Welcome back, ${user.name}</h2>
            <p class="text-sm text-gray-600">Your personalized study recommendations are below.</p>
            <div id="rec-plan" class="mt-4"></div>
          </div>

          <div class="bg-white p-6 rounded-xl card-shadow">
            <h3 class="font-semibold mb-2">Quick Actions</h3>
            <div class="space-y-2">
              <button id="gen-flash" class="px-3 py-2 bg-indigo-600 text-white rounded">Generate Flashcards</button>
              <button id="gen-quiz" class="px-3 py-2 bg-green-600 text-white rounded">Generate Quiz</button>
              <button id="start-study" class="px-3 py-2 bg-yellow-500 text-white rounded">Start Study Session</button>
            </div>
          </div>
        </div>
        <div class="mt-6 bg-white p-6 rounded-xl card-shadow">
          <h3 class="font-semibold mb-2">Progress Overview</h3>
          <canvas id="progress-chart" height="120"></canvas>
        </div>
      `;

      setTimeout(()=>{
        try{
          const plan = AI.recommendStudyPlan(user, s);
          const div = wrap.querySelector('#rec-plan');
          if(plan && plan.items) div.innerHTML = '<ul class="list-disc pl-5">' + plan.items.map(it=>{
            const subj = s.find(x=>x.id===it.subjectId) || {name: 'Unknown'};
            return `<li>${subj.name}: ${it.percent}%</li>`;
          }).join('') + '</ul>';

          const genFlashBtn = wrap.querySelector('#gen-flash');
          if(genFlashBtn) genFlashBtn.addEventListener('click', ()=>{
            if(!s || s.length===0) return alert('No subjects available to generate for');
            const cards = AI.generateFlashcards(s[0], 8);
            cards.forEach(c=>DB.flashcards.add(c));
            alert('Generated '+cards.length+' flashcards for '+s[0].name);
          });

          const genQuizBtn = wrap.querySelector('#gen-quiz');
          if(genQuizBtn) genQuizBtn.addEventListener('click', ()=>{
            if(!s || s.length===0) return alert('No subjects available to generate for');
            const q = AI.generateQuiz(s[0], 6);
            DB.quizzes.add(q);
            alert('Generated quiz: '+q.title);
          });

              // nothing here; chart will be rendered below and will include quiz attempt dataset when available

          const startStudyBtn = wrap.querySelector('#start-study');
          if(startStudyBtn) startStudyBtn.addEventListener('click', ()=>{ if(s && s[0]) this.startStudySession(s[0]); });

          // render chart
          setTimeout(()=>{
            try{
              const ctx = wrap.querySelector('#progress-chart').getContext('2d');
              const sessions = DB.sessions.list();
              const attempts = DB.quizAttempts ? DB.quizAttempts.list() : [];
              const labels = s.map(x=>x.name);
              const data = s.map(x=>sessions.filter(ss=>ss.subjectId===x.id).length);
              // compute average quiz percent per subject
              const quizPercent = s.map(x=>{
                const as = attempts.filter(a=>a.subjectId===x.id && a.total>0);
                if(!as || as.length===0) return 0;
                const avg = as.reduce((acc,a)=> acc + (a.score / a.total * 100), 0) / as.length;
                return Math.round(avg);
              });
              new Chart(ctx, { type: 'bar', data: { labels, datasets: [ { label: 'Sessions', data, backgroundColor: ['#4F46E5','#10B981','#F59E0B'] }, { label: 'Quiz Success %', data: quizPercent, type: 'line', borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', yAxisID: 'y1' } ] }, options: { responsive:true, scales: { y: { beginAtZero:true }, y1: { position: 'right', beginAtZero:true, max:100, grid: { drawOnChartArea: false } } } } });
            }catch(e){ console.warn('Chart render failed', e); }
          },200);
        }catch(err){ console.warn('Dashboard init failed', err); }
      },100);

      return wrap;
    },

    renderSubjects(){
      const wrap = document.createElement('div');
      wrap.className = 'p-6';
      const subjects = DB.subjects.list();
      wrap.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-semibold">Subjects</h2>
            <p class="text-sm text-gray-500">Organize topics, generate content and track progress.</p>
          </div>
          <div class="flex items-center space-x-2">
            <div class="relative">
              <input id="new-subj" placeholder="Add a subject (e.g. Calculus)" class="border p-3 rounded-full w-64 pl-4 pr-12 focus:ring-2 focus:ring-indigo-300" />
              <button id="add-subj" class="absolute right-1 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 rounded-full shadow-lg hover:scale-105 transition">＋</button>
            </div>
            <div class="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
              <span class="mr-2">Quick:</span>
              <button class="quick-subj px-3 py-1 bg-gray-100 rounded" data-name="Calculus">Calculus</button>
              <button class="quick-subj px-3 py-1 bg-gray-100 rounded" data-name="Algorithms">Algorithms</button>
              <button class="quick-subj px-3 py-1 bg-gray-100 rounded" data-name="Linear Algebra">Linear Algebra</button>
            </div>
          </div>
        </div>

        <div id="subject-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></div>
      `;

      const grid = wrap.querySelector('#subject-grid');

      const renderCard = (s) => {
        // compute some lightweight stats
        const sessions = DB.sessions.list().filter(ss=>ss.subjectId===s.id).length;
        const cards = DB.flashcards.list().filter(fc=>fc.subjectId===s.id).length;
        const quizzes = DB.quizzes.list().filter(q=>q.subjectId===s.id).length;

  const elCard = document.createElement('div');
  elCard.className = 'bg-white p-5 rounded-xl card-shadow flex flex-col hover:shadow-lg transform hover:-translate-y-1 transition';
        elCard.innerHTML = `
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">${(s.name||'S').slice(0,2).toUpperCase()}</div>
              <div>
                <div class="font-medium text-lg">${s.name}</div>
            <div class="text-sm text-gray-500">${s.description || ''}</div>
              </div>
            </div>
            <div class="text-right text-sm text-gray-500">${sessions} sessions</div>
          </div>
          <div class="mt-4 flex-1">
            <div class="text-xs text-gray-500 mb-2">Progress</div>
            <div class="h-2 bg-gray-200 rounded-full">
              <div class="h-2 bg-indigo-500 rounded-full" style="width: ${Math.min(100, (sessions*10 + cards*5 + quizzes*8))}%"></div>
            </div>
          </div>
            <div class="mt-4 flex items-center justify-between">
            <div class="flex items-center space-x-2 text-sm text-gray-600">
              <div class="px-2 py-1 bg-gray-100 rounded">📚 ${cards}</div>
              <div class="px-2 py-1 bg-gray-100 rounded">📝 ${quizzes}</div>
            </div>
            <div class="flex items-center space-x-2">
              <button data-id="${s.id}" class="view-subj px-3 py-1 bg-indigo-600 text-white rounded text-sm">View</button>
              <button data-id="${s.id}" class="gen-subj px-3 py-1 bg-green-600 text-white rounded text-sm">Generate</button>
              <button data-id="${s.id}" class="del-subj text-red-600 text-sm">Delete</button>
            </div>
          </div>
        `;

        // attach handlers
        elCard.querySelector('.view-subj').addEventListener('click', ()=>{ this.renderSubjectPage(s.id); });
        elCard.querySelector('.gen-subj').addEventListener('click', ()=>{
          const cards = AI.generateFlashcards(s, 6);
          cards.forEach(c=>DB.flashcards.add(c));
          const q = AI.generateQuiz(s, 5); DB.quizzes.add(q);
          // re-render grid to reflect counts
          refreshGrid();
          // give subtle feedback
          const toast = document.createElement('div'); toast.className='fixed bottom-6 right-6 bg-indigo-600 text-white px-4 py-2 rounded shadow'; toast.textContent = 'Generated 6 flashcards and a quiz for ' + s.name; document.body.appendChild(toast); setTimeout(()=>toast.remove(),2500);
        });
        elCard.querySelector('.del-subj').addEventListener('click', ()=>{ if(confirm('Delete subject '+s.name+'?')){ DB.subjects.remove(s.id); refreshGrid(); } });

        return elCard;
      };

      const refreshGrid = () => {
        grid.innerHTML = '';
        DB.subjects.list().forEach(s=> grid.appendChild(renderCard(s)));
      };

      setTimeout(()=>{
        refreshGrid();
        const inputEl = wrap.querySelector('#new-subj');
        const addBtn = wrap.querySelector('#add-subj');
        const doAdd = (name) => {
          const nm = (name || inputEl.value || '').trim();
          if(!nm) return alert('Enter subject name');
          const subj = { id: 's_'+Math.random().toString(36).slice(2,8), name: nm, description: '' };
          DB.subjects.add(subj);
          inputEl.value = '';
          refreshGrid();
          // subtle feedback
          const t = document.createElement('div'); t.className='fixed bottom-6 left-6 bg-indigo-600 text-white px-4 py-2 rounded shadow'; t.textContent = 'Added "' + nm + '"'; document.body.appendChild(t); setTimeout(()=>t.remove(),1800);
        };

        addBtn.addEventListener('click', ()=> doAdd());
        inputEl.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ doAdd(); } });
        wrap.querySelectorAll('.quick-subj').forEach(b=> b.addEventListener('click', ()=> doAdd(b.dataset.name)));
      },50);

      return wrap;
    },

    renderSubjectPage(subjectId){
      const subj = DB.subjects.list().find(s=>s.id===subjectId);
      if(!subj) return this.renderSubjects();
      const wrap = document.createElement('div'); wrap.className='p-6';
      const cards = DB.flashcards.list().filter(c=>c.subjectId===subj.id);
      const quizzes = DB.quizzes.list().filter(q=>q.subjectId===subj.id);

      wrap.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <button id="back-subj" class="text-sm text-gray-500 mr-3">← Back</button>
            <h2 class="text-2xl font-semibold inline">${subj.name}</h2>
            <div class="text-sm text-gray-500">${subj.description || 'No description yet.'}</div>
          </div>
          <div class="flex items-center space-x-2">
            <button id="gen-more" class="px-3 py-2 bg-green-600 text-white rounded">Generate Content</button>
            <button id="start-review" class="px-3 py-2 bg-indigo-600 text-white rounded">Start Review</button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="bg-white p-5 rounded-xl card-shadow">
            <h3 class="font-medium mb-3">Overview</h3>
            <p class="text-sm text-gray-600 mb-4">Sessions, flashcards and quizzes for this subject.</p>
            <div class="space-y-2">
              <div class="flex justify-between"><span class="text-sm text-gray-500">Sessions</span><strong>${DB.sessions.list().filter(s=>s.subjectId===subj.id).length}</strong></div>
              <div class="flex justify-between"><span class="text-sm text-gray-500">Flashcards</span><strong>${cards.length}</strong></div>
              <div class="flex justify-between"><span class="text-sm text-gray-500">Quizzes</span><strong>${quizzes.length}</strong></div>
            </div>
            <div class="mt-4">
              <canvas id="sub-progress-chart" height="120"></canvas>
            </div>
          </div>

          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white p-5 rounded-xl card-shadow">
              <h3 class="font-medium mb-3">Flashcards</h3>
              <div id="sub-cards" class="space-y-2 text-sm text-gray-700"></div>
            </div>

            <div class="bg-white p-5 rounded-xl card-shadow">
              <h3 class="font-medium mb-3">Quizzes</h3>
              <div id="sub-quizzes" class="space-y-2 text-sm text-gray-700"></div>
            </div>
          </div>
        </div>
      `;

      setTimeout(()=>{
        wrap.querySelector('#back-subj').addEventListener('click', ()=> this.renderView('subjects'));
        wrap.querySelector('#gen-more').addEventListener('click', ()=>{
          const c = AI.generateFlashcards(subj,6); c.forEach(x=>DB.flashcards.add(x));
          const q=AI.generateQuiz(subj,5); DB.quizzes.add(q);
          // re-render the same subject page to show new content
          this.renderSubjectPage(subj.id);
          const toast = document.createElement('div'); toast.className='fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded shadow'; toast.textContent = 'Generated content for ' + subj.name; document.body.appendChild(toast); setTimeout(()=>toast.remove(),2500);
        });
        wrap.querySelector('#start-review').addEventListener('click', ()=>{ if(cards.length) this.startFlashcardReview(); else alert('No flashcards to review'); });
        // allow editing description
        const editBtn = document.createElement('button'); editBtn.id='edit-desc'; editBtn.className='ml-3 text-sm text-indigo-600'; editBtn.textContent='Edit Description';
        wrap.querySelector('#back-subj').insertAdjacentElement('afterend', editBtn);
        editBtn.addEventListener('click', ()=>{
          const val = prompt('Enter description for '+subj.name, subj.description||'');
          if(val!==null){ DB.subjects.update(subj.id, { description: val }); this.renderSubjectPage(subj.id); }
        });

        // populate lists
        const croot = wrap.querySelector('#sub-cards');
        if(cards.length===0) croot.innerHTML = '<div class="text-sm text-gray-500">No flashcards yet.</div>';
        else croot.innerHTML = cards.map(cc=>`<div class="p-2 border-b"><div class="font-medium">${cc.question}</div><div class="text-xs text-gray-500">${cc.answer}</div></div>`).join('');

        const qroot = wrap.querySelector('#sub-quizzes');
        if(quizzes.length===0) qroot.innerHTML = '<div class="text-sm text-gray-500">No quizzes yet.</div>';
        else qroot.innerHTML = quizzes.map(q=>`<div class="p-2 border-b flex justify-between items-center"><div><div class="font-medium">${q.title}</div><div class="text-xs text-gray-500">${q.questions.length} questions</div></div><div><button data-id="${q.id}" class="take-sub-quiz px-2 py-1 bg-indigo-600 text-white rounded text-sm">Take</button></div></div>`).join('');
        wrap.querySelectorAll('.take-sub-quiz').forEach(b=>b.addEventListener('click', e=> this.takeQuizModal(b.dataset.id)));

        // small progress chart: distribution of content
        try{
          const ctx = wrap.querySelector('#sub-progress-chart').getContext('2d');
          new Chart(ctx, { type:'doughnut', data:{ labels:['Flashcards','Quizzes','Sessions'], datasets:[{ data:[cards.length, quizzes.length, DB.sessions.list().filter(s=>s.subjectId===subj.id).length], backgroundColor:['#4F46E5','#10B981','#F59E0B'] }] }, options:{ responsive:true } });
        }catch(e){ console.warn('subject chart failed', e); }
      },50);

      this.renderView = this.renderView.bind(this);
      // replace root content
      const root = el('#view-root'); if(root){ root.innerHTML=''; root.appendChild(wrap); }
    },

    renderAiTutor(){
      const wrap = document.createElement('div'); wrap.className='p-6';
      wrap.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <div class="bg-white p-4 rounded-xl card-shadow mb-4">
              <h2 class="text-xl font-semibold">AI Tutor Assistant</h2>
              <p class="text-sm text-gray-500">Ask questions, generate flashcards, quizzes or cheat sheets instantly.</p>
            </div>

            <div id="chat-box" class="bg-white p-4 rounded-xl card-shadow h-96 overflow-y-auto flex flex-col space-y-3">
              <!-- messages will be appended here -->
            </div>

            <div class="mt-3 flex items-center space-x-2">
              <input id="ai-input" placeholder="Ask me about calculus, algorithms or study tips..." class="flex-1 border p-2 rounded" />
              <button id="ai-send" class="px-4 py-2 bg-indigo-600 text-white rounded">Send</button>
              <button id="ai-actions" class="px-3 py-2 bg-gray-100 rounded">Actions</button>
            </div>

            <div class="mt-3 flex space-x-2 text-sm text-gray-500">
              <button class="ai-quick px-3 py-1 bg-gray-100 rounded" data-prompt="Explain derivatives in simple terms">Explain derivatives</button>
              <button class="ai-quick px-3 py-1 bg-gray-100 rounded" data-prompt="Create 5 flashcards for limits">Generate flashcards</button>
              <button class="ai-quick px-3 py-1 bg-gray-100 rounded" data-prompt="Make a short quiz on trees">Generate quiz</button>
            </div>
          </div>

          <div>
            <div class="bg-white p-4 rounded-xl card-shadow">
              <h3 class="font-medium mb-2">AI Tools</h3>
              <div class="space-y-2 text-sm">
                <div><button id="save-flash" class="w-full px-3 py-2 bg-indigo-600 text-white rounded">Save Last as Flashcards</button></div>
                <div><button id="save-quiz" class="w-full px-3 py-2 bg-green-600 text-white rounded">Save Last as Quiz</button></div>
                <div><button id="save-cs" class="w-full px-3 py-2 bg-yellow-500 text-white rounded">Save Last as Cheatsheet</button></div>
              </div>
            </div>

            <div class="bg-white p-4 rounded-xl card-shadow mt-4">
              <h4 class="font-medium mb-2">Tips</h4>
              <ul class="text-sm text-gray-600 list-disc pl-5">
                <li>Be specific in prompts for better results.</li>
                <li>Use "Generate flashcards" or "Make quiz" quick prompts to get testable content.</li>
              </ul>
            </div>
          </div>
        </div>
      `;

      // state to hold last AI output
      let lastAIOutput = null;

      const chatBox = wrap.querySelector('#chat-box');
      const handleAiAction = (action)=>{
        if(action === 'save-flash'){
          const s = DB.subjects.list()[0] || {id:'s1', name:'General'};
          const cards = AI.generateFlashcards(s,4);
          cards.forEach(c=>DB.flashcards.add(c));
          alert('Saved '+cards.length+' flashcards');
        } else if(action === 'save-cheatsheet'){
          const s = DB.subjects.list()[0]||{id:'s1'};
          const cs = AI.generateCheatsheet(s);
          DB.cheatsheets.add(cs);
          alert('Cheatsheet saved');
        } else if(action === 'save-quiz'){
          const s = DB.subjects.list()[0]||{id:'s1'};
          const q = AI.generateQuiz(s,5);
          DB.quizzes.add(q);
          alert('Saved quiz: '+q.title);
        } else {
          console.log('Unknown AI action', action);
        }
      };

      const pushMessage = (who, text, payload)=>{
        const m = document.createElement('div'); m.className = who === 'ai' ? 'self-start bg-gray-100 p-3 rounded-lg max-w-xl' : 'self-end bg-indigo-600 text-white p-3 rounded-lg max-w-xl';
        m.innerHTML = `<div class="text-sm">${text.replace(/\n/g,'<br>')}</div>`;
        if(payload && payload.buttons){
          const btns = document.createElement('div'); btns.className='mt-2 flex space-x-2';
          payload.buttons.forEach(b=>{
            const elb = document.createElement('button');
            elb.className='px-2 py-1 bg-white text-sm rounded border';
            elb.textContent=b.label;
            if(b.onClick && typeof b.onClick === 'function'){
              elb.addEventListener('click', ()=> b.onClick());
            } else if(b.action){
              elb.dataset.action = b.action;
              elb.addEventListener('click', ()=> handleAiAction(b.action));
            }
            btns.appendChild(elb);
          });
          m.appendChild(btns);
        }
        chatBox.appendChild(m); chatBox.scrollTop = chatBox.scrollHeight;
      };

      // seed sample conversation
      pushMessage('ai', 'Hi! I\'m your AI tutor. Ask me anything — I can explain concepts, make flashcards, or generate quizzes.');
      pushMessage('user', 'Can you create 4 flashcards on derivatives?');

      // simulate AI response for the sample
      setTimeout(()=>{
        const resp = 'Sure — here are 4 sample flashcards:\n1) Definition of derivative - The derivative of f at x...\n2) Power rule - d/dx x^n = n x^{n-1}\n3) Product rule - (fg)' + " = f'g + fg'" + '\n4) Chain rule - d/dx f(g(x)) = f\'(g(x)) g\'(x)';
        pushMessage('ai', resp);
        lastAIOutput = { type:'text', content: resp };
      }, 1000);

      // handlers
      const inputEl = wrap.querySelector('#ai-input');
      const sendBtn = wrap.querySelector('#ai-send');
      const quicks = wrap.querySelectorAll('.ai-quick');

      const simulateAiThinking = (prompt, cb)=>{
        // show typing indicator
        const typ = document.createElement('div'); typ.className='self-start p-2 rounded-lg text-sm text-gray-500'; typ.id='ai-typing'; typ.textContent='AI is typing...'; chatBox.appendChild(typ); chatBox.scrollTop = chatBox.scrollHeight;
        setTimeout(()=>{ typ.remove(); const out = AI.generateCheatsheet({name:prompt.replace(/^Generate |^Make |^Create /i,'')}); cb(out); }, 900 + Math.random()*900);
      };

      sendBtn.addEventListener('click', ()=>{
        const txt = inputEl.value.trim(); if(!txt) return;
        pushMessage('user', txt);
        inputEl.value = '';
        simulateAiThinking(txt, (out)=>{
          // convert object to nice string
          let respText = '';
          if(typeof out === 'string') respText = out;
          else if(out.title && out.content) respText = `${out.title}\n\n${out.content}`;
          else respText = JSON.stringify(out);
          pushMessage('ai', respText, { buttons: [ { label:'Save as Flashcards', action: 'save-flash' }, { label:'Save as Cheatsheet', action: 'save-cheatsheet' } ] });
          lastAIOutput = { type:'cheatsheet', content: out };
        });
      });

      quicks.forEach(b=> b.addEventListener('click', ()=>{ inputEl.value = b.dataset.prompt; sendBtn.click(); }));

      // AI tool buttons
      wrap.querySelector('#save-flash').addEventListener('click', ()=>{
        // try convert last output to flashcards
        const s = DB.subjects.list()[0] || {id:'s1', name:'General'};
        const cards = AI.generateFlashcards(s,4); cards.forEach(c=>DB.flashcards.add(c)); alert('Saved '+cards.length+' flashcards');
      });
      wrap.querySelector('#save-quiz').addEventListener('click', ()=>{ const s = DB.subjects.list()[0]||{id:'s1'}; const q = AI.generateQuiz(s,5); DB.quizzes.add(q); alert('Saved quiz: '+q.title); });
      wrap.querySelector('#save-cs').addEventListener('click', ()=>{ const s = DB.subjects.list()[0]||{id:'s1'}; const cs = AI.generateCheatsheet(s); DB.cheatsheets.add(cs); alert('Saved cheatsheet'); });

      return wrap;
    },

    renderStudy(){
      const wrap = document.createElement('div'); wrap.className='p-6';
      const sessions = DB.sessions.list().slice().sort((a,b)=> (a.scheduled||0) - (b.scheduled||0));
      wrap.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-semibold">Study Sessions</h2>
            <p class="text-sm text-gray-500">Upcoming, past and quick-start sessions to keep your momentum.</p>
          </div>
          <div class="flex items-center space-x-2">
            <button id="new-session" class="px-4 py-2 bg-indigo-600 text-white rounded shadow">New Session</button>
            <button id="start-pomo" class="px-3 py-2 bg-yellow-500 text-white rounded">Quick Pomodoro</button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <div id="upcoming-list" class="space-y-4"></div>
          </div>
          <div>
            <div class="bg-white p-4 rounded-xl card-shadow">
              <h3 class="font-medium mb-3">Your Streak & Progress</h3>
              <div class="text-center">
                <div class="text-4xl font-bold text-indigo-600" id="study-streak">0</div>
                <div class="text-sm text-gray-500">Day streak</div>
              </div>
              <div class="mt-4">
                <h4 class="text-sm text-gray-500 mb-2">Quick Actions</h4>
                <div class="space-y-2">
                  <button id="start-random" class="w-full px-3 py-2 bg-green-600 text-white rounded">Start Random Review</button>
                  <button id="view-history" class="w-full px-3 py-2 bg-gray-100 rounded">View History</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- New Session Modal (hidden) -->
        <div id="modal-root"></div>
      `;

      const listRoot = wrap.querySelector('#upcoming-list');

      const fmt = (ts)=>{ const d=new Date(ts); return d.toLocaleString(); };

      const renderSessionCard = (sess)=>{
        const subj = DB.subjects.list().find(x=>x.id===sess.subjectId) || {name:'General'};
        const card = document.createElement('div'); card.className='bg-white p-4 rounded-xl card-shadow flex items-center justify-between';
        card.innerHTML = `
          <div>
            <div class="font-medium">${sess.title || subj.name + ' Study'}</div>
            <div class="text-xs text-gray-500">${subj.name} • ${fmt(sess.scheduled||Date.now())}</div>
          </div>
          <div class="flex items-center space-x-2">
            <button data-id="${sess.id}" class="resume px-3 py-1 bg-indigo-600 text-white rounded">Start</button>
            <button data-id="${sess.id}" class="edit px-3 py-1 bg-gray-100 rounded">Edit</button>
          </div>
        `;
        card.querySelector('.resume').addEventListener('click', ()=> this.startStudySessionFromData(sess));
        card.querySelector('.edit').addEventListener('click', ()=>{ this.showEditSessionModal(sess); });
        return card;
      };

      const refresh = ()=>{
        listRoot.innerHTML = '';
        sessions.forEach(s=> listRoot.appendChild(renderSessionCard(s)));
        const streakEl = wrap.querySelector('#study-streak'); if(streakEl) streakEl.textContent = DB.users.list()[0].streak || 0;
      };

      setTimeout(()=>{
        refresh();
        // new session modal
        wrap.querySelector('#new-session').addEventListener('click', ()=> this.showNewSessionModal());
        wrap.querySelector('#start-pomo').addEventListener('click', ()=> this.startPomodoro());
        wrap.querySelector('#start-random').addEventListener('click', ()=>{ const all = DB.flashcards.list(); if(all.length) { DB.flashcards.list(); this.startFlashcardReview(); } else alert('No content to review'); });
      },50);

      return wrap;
    },

    // start from a stored session object (keeps session data)
    startStudySessionFromData(sess){
      // create a modal with nicer controls
      const subject = DB.subjects.list().find(s=>s.id===sess.subjectId) || {name:'General'};
      const modal = document.createElement('div'); modal.className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `<div class="bg-white w-96 rounded-lg p-6">
        <div class="flex justify-between items-center"><div><h3 class="font-semibold">${sess.title || subject.name}</h3><div class="text-sm text-gray-500">${subject.name}</div></div><button id="close-modal" class="text-gray-500">✕</button></div>
        <div class="my-4 text-center"><div id="session-timer" class="text-4xl font-bold">00:00</div><div class="text-sm text-gray-500 mt-2">${Math.round((sess.duration||25*60*1000)/60000)} min</div></div>
        <div class="flex justify-between">
          <button id="pause" class="px-4 py-2 bg-gray-100 rounded">Pause</button>
          <button id="end" class="px-4 py-2 bg-red-500 text-white rounded">End</button>
          <button id="complete" class="px-4 py-2 bg-green-600 text-white rounded">Complete</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      const tEl = modal.querySelector('#session-timer');
      let total = Math.round((sess.duration||25*60*1000)/1000);
      let rem = total; const iv = setInterval(()=>{ rem--; const mm = String(Math.floor(rem/60)).padStart(2,'0'); const ss = String(rem%60).padStart(2,'0'); tEl.textContent = `${mm}:${ss}`; if(rem<=0){ clearInterval(iv); alert('Session complete'); document.body.removeChild(modal); } },1000);
      modal.querySelector('#close-modal').addEventListener('click', ()=>{ clearInterval(iv); document.body.removeChild(modal); });
      modal.querySelector('#end').addEventListener('click', ()=>{ clearInterval(iv); document.body.removeChild(modal); alert('Session ended'); });
      modal.querySelector('#complete').addEventListener('click', ()=>{ clearInterval(iv); document.body.removeChild(modal); const u = DB.users.list()[0]; DB.users.incrementStreak(u.id); alert('Great job! Session marked complete.'); this.populateCoins(); });
    },

    showNewSessionModal(){
      const modal = document.createElement('div'); modal.className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `<div class="bg-white w-96 rounded-lg p-6">
        <h3 class="font-semibold mb-2">Create New Session</h3>
        <div class="space-y-2">
          <input id="ns-title" placeholder="Session title" class="w-full border p-2 rounded" />
          <select id="ns-subj" class="w-full border p-2 rounded"></select>
          <input id="ns-min" type="number" value="25" class="w-full border p-2 rounded" />
        </div>
        <div class="mt-4 flex justify-end"><button id="ns-create" class="px-4 py-2 bg-indigo-600 text-white rounded">Create</button></div>
      </div>`;
      document.body.appendChild(modal);
      const sel = modal.querySelector('#ns-subj'); DB.subjects.list().forEach(s=>{ const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o); });
      modal.querySelector('#ns-create').addEventListener('click', ()=>{
        const title = modal.querySelector('#ns-title').value.trim() || 'Study Session';
        const subjectId = modal.querySelector('#ns-subj').value;
        const mins = Number(modal.querySelector('#ns-min').value) || 25;
        const sess = { id: 'sess_'+Math.random().toString(36).slice(2,8), userId: DB.users.list()[0].id, subjectId, title, scheduled: Date.now(), duration: mins*60*1000, completed:false };
        DB.sessions.add(sess);
        modal.remove();
        this.renderView('study');
      });
    },

    showEditSessionModal(sess){
      // reuse new session modal with prefill
      this.showNewSessionModal();
    },

    startStudySession(subject){
      if(!subject) return alert('No subject selected');
      const session = { id: 'sess_'+Math.random().toString(36).slice(2,9), userId: DB.users.list()[0].id, subjectId: subject.id, started: Date.now(), duration:0 };
      DB.sessions.add(session);
      // open a simple timer modal
      const modal = document.createElement('div'); modal.className='fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center';
      modal.innerHTML = `<div class="bg-white p-6 rounded-lg w-96">\n        <h3 class="font-semibold">Studying: ${subject.name}</h3>\n        <div id="timer" class="text-3xl my-4">00:00:00</div>\n        <div class="flex space-x-2">\n          <button id="stop" class="px-3 py-2 bg-red-500 text-white rounded">Stop</button>\n          <button id="add-coin" class="px-3 py-2 bg-green-600 text-white rounded">Earn Coin</button>\n        </div>\n      </div>`;
      document.body.appendChild(modal);
      const start = Date.now();
      const tEl = modal.querySelector('#timer');
      const iv = setInterval(()=>{
        const diff = Date.now() - start; const h = String(Math.floor(diff/3600000)).padStart(2,'0'); const m = String(Math.floor(diff%3600000/60000)).padStart(2,'0'); const s = String(Math.floor(diff%60000/1000)).padStart(2,'0');
        tEl.textContent = `${h}:${m}:${s}`;
      }, 500);
      modal.querySelector('#stop').addEventListener('click', ()=>{ clearInterval(iv); document.body.removeChild(modal); session.duration = Date.now()-start; DB.sessions.add(session); alert('Session ended. Duration: '+Math.round(session.duration/1000)+'s'); });
      modal.querySelector('#add-coin').addEventListener('click', ()=>{ const u=DB.users.list()[0]; u.coins = (u.coins||0)+1; DB.users.update(u.id, {coins: u.coins}); this.populateCoins(); alert('Coin earned!'); });
    },

    renderFlashcards(){
      const wrap = document.createElement('div'); wrap.className='p-6';
      const cards = DB.flashcards.list();
      wrap.innerHTML = `
        <div class="bg-white p-6 rounded-xl card-shadow">
          <h2 class="text-lg font-semibold mb-4">Flashcards</h2>
          <div><button id="review-btn" class="px-3 py-2 bg-indigo-600 text-white rounded mb-3">Start Review</button></div>
          <div id="cards-root"></div>
        </div>
      `;
      setTimeout(()=>{
        const root = wrap.querySelector('#cards-root');
        if(cards.length===0) root.innerHTML = '<div class="text-sm text-gray-500">No flashcards. Generate some from Dashboard.</div>';
        else root.innerHTML = cards.map(c=>`<div class="p-3 border-b">\n            <div class="font-medium">${c.question}</div>\n            <div class="text-sm text-gray-600">${c.answer}</div>\n        </div>`).join('');
        const review = wrap.querySelector('#review-btn'); if(review) review.addEventListener('click', ()=>this.startFlashcardReview());
      },20);
      return wrap;
    },

    renderQuizzes(){
      const wrap = document.createElement('div'); wrap.className='p-6';
      const quizzes = DB.quizzes.list();
      wrap.innerHTML = `
        <div class="bg-white p-6 rounded-xl card-shadow">\n          <h2 class="text-lg font-semibold mb-4">Quizzes</h2>\n          <div class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">\n            <div>\n              <label class="text-sm text-gray-600">Subject</label>\n              <select id="gen-subj" class="w-full border p-2 rounded"></select>\n            </div>\n            <div>\n              <label class="text-sm text-gray-600">Number of questions</label>\n              <input id="gen-num" type="number" value="5" class="w-full border p-2 rounded" />\n            </div>\n            <div>\n              <button id="gen-quiz-btn" class="w-full px-3 py-2 bg-green-600 text-white rounded">Generate Quiz</button>\n            </div>\n          </div>\n          <div id="quiz-list"></div>\n        </div>\n      `;
      setTimeout(()=>{
        // populate subject selector and wire toggle
        const subjSel = wrap.querySelector('#gen-subj'); DB.subjects.list().forEach(s=>{ const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; subjSel.appendChild(o); });
        const toggle = wrap.querySelector('#create-test-toggle'); const form = wrap.querySelector('#create-test-form');
        if(toggle && form){
          toggle.addEventListener('click', ()=>{
            if(form.style.maxHeight && form.style.maxHeight !== '0px'){ // hide
              form.style.maxHeight = '0'; form.style.opacity = '0';
            } else { // show - calculate height
              form.style.maxHeight = '300px'; form.style.opacity = '1';
            }
          });
        }
        wrap.querySelector('#gen-quiz-btn').addEventListener('click', ()=>{
          const sid = subjSel.value; const num = Math.max(1, Math.min(30, Number(wrap.querySelector('#gen-num').value)||5));
          const subj = DB.subjects.list().find(x=>x.id===sid);
          if(!subj) return alert('Select a subject');
          const q = AI.generateQuiz(subj, num);
          q.subjectId = subj.id;
          DB.quizzes.add(q);
          const t = document.createElement('div'); t.className='fixed top-6 right-6 bg-green-600 text-white px-4 py-2 rounded shadow transform scale-95 animate-pulse'; t.textContent = 'Generated quiz: '+q.title; document.body.appendChild(t); setTimeout(()=>t.remove(),2200);
          this.renderView('quizzes');
        });

        const root = wrap.querySelector('#quiz-list');
        if(quizzes.length===0) root.innerHTML = '<div class="text-sm text-gray-500">No quizzes yet. Generate one above.</div>';
        else root.innerHTML = quizzes.map(q=>`<div class="p-3 border-b flex justify-between items-center">\n          <div>\n            <div class="font-medium">${q.title}</div>\n            <div class="text-sm text-gray-600">${q.questions.length} questions</div>\n          </div>\n          <div class="flex items-center space-x-2"><div class="text-xs text-gray-500">${DB.subjects.list().find(s=>s.id===q.subjectId)?.name||'General'}</div><button data-id="${q.id}" class="take-quiz px-3 py-1 bg-indigo-600 text-white rounded">Take</button></div>\n        </div>`).join('');
        root.querySelectorAll('.take-quiz').forEach(b=>b.addEventListener('click', e=>{ this.takeQuizModal(b.dataset.id); }));
      },20);
      return wrap;
    },

    startPomodoro(){
      const modal = document.createElement('div'); modal.className='fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center';
      let sec = 25 * 60;
      modal.innerHTML = `<div class="bg-white p-6 rounded-lg w-80"><h3 class="font-semibold">Pomodoro</h3><div id="pom-t" class="text-3xl my-4">25:00</div><div class="flex space-x-2"><button id="pom-stop" class="px-3 py-2 bg-red-500 text-white rounded">Stop</button><button id="pom-done" class="px-3 py-2 bg-green-600 text-white rounded">Finish</button></div></div>`;
      document.body.appendChild(modal);
      const tEl = modal.querySelector('#pom-t');
      const iv = setInterval(()=>{ sec--; const m = String(Math.floor(sec/60)).padStart(2,'0'); const s = String(sec%60).padStart(2,'0'); tEl.textContent = `${m}:${s}`; if(sec<=0){ clearInterval(iv); alert('Pomodoro complete'); document.body.removeChild(modal); } },1000);
      modal.querySelector('#pom-stop').addEventListener('click', ()=>{ clearInterval(iv); document.body.removeChild(modal); });
      modal.querySelector('#pom-done').addEventListener('click', ()=>{ clearInterval(iv); document.body.removeChild(modal); alert('Session recorded'); });
    },

    startFlashcardReview(){
      const cards = DB.flashcards.list();
      if(!cards || cards.length===0) return alert('No flashcards available');
      let idx = 0;
      const show = ()=>{
        const c = cards[idx];
        const modal = document.createElement('div'); modal.className='fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center';
        modal.innerHTML = `<div class="bg-white p-6 rounded-lg w-96"><h3 class="font-semibold">Review (${idx+1}/${cards.length})</h3><div class="font-medium text-lg my-3">${c.question}</div><div id="ans" class="text-sm text-gray-600 hidden">${c.answer}</div><div class="mt-4 space-x-2"><button id="show" class="px-3 py-2 bg-indigo-600 text-white rounded">Show Answer</button><button id="easy" class="px-2 py-1 bg-green-500 text-white rounded">Easy</button><button id="good" class="px-2 py-1 bg-yellow-500 text-white rounded">Good</button><button id="hard" class="px-2 py-1 bg-red-500 text-white rounded">Hard</button><button id="close" class="px-3 py-2 bg-gray-200 rounded">Close</button></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('#show').addEventListener('click', ()=> modal.querySelector('#ans').classList.remove('hidden'));
        modal.querySelector('#close').addEventListener('click', ()=> document.body.removeChild(modal));
        modal.querySelector('#easy').addEventListener('click', ()=>{ AI.sm2(c,5); DB.flashcards.update(c.id,c); document.body.removeChild(modal); idx++; if(idx<cards.length) show(); else alert('Review complete'); });
        modal.querySelector('#good').addEventListener('click', ()=>{ AI.sm2(c,4); DB.flashcards.update(c.id,c); document.body.removeChild(modal); idx++; if(idx<cards.length) show(); else alert('Review complete'); });
        modal.querySelector('#hard').addEventListener('click', ()=>{ AI.sm2(c,2); DB.flashcards.update(c.id,c); document.body.removeChild(modal); idx++; if(idx<cards.length) show(); else alert('Review complete'); });
      };
      show();
    },

    takeQuizModal(id){
      const q = DB.quizzes.list().find(x=>x.id===id);
      if(!q) return alert('Quiz not found');
      let idx = 0; let score = 0;
      const user = DB.users.list()[0] || {id:'u1'};
      const showResult = ()=>{
        // record attempt
        try{
          const attempt = { id: 'qa_'+Math.random().toString(36).slice(2,9), quizId: q.id, subjectId: q.subjectId || null, userId: user.id, score, total: q.questions.length, timestamp: Date.now() };
          if(DB.quizAttempts) DB.quizAttempts.add(attempt);
        }catch(e){ console.warn('Could not record quiz attempt', e); }
        const modal = document.createElement('div'); modal.className='fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center';
        modal.innerHTML = `<div class="bg-white p-6 rounded-lg w-96 animate-fade-in"><h3 class="font-semibold">Results</h3><div class="my-3 text-center text-2xl font-bold">${score}/${q.questions.length}</div><div class="text-sm text-gray-600 mb-4">You earned ${Math.round(score/q.questions.length*5)} coins</div><div class="flex justify-end"><button id="close" class="px-3 py-2 bg-indigo-600 text-white rounded">Close</button></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('#close').addEventListener('click', ()=>{ document.body.removeChild(modal); this.renderView('dashboard'); });
      };

      const render = ()=>{
        const qu = q.questions[idx];
        const modal = document.createElement('div'); modal.className='fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center';
        modal.innerHTML = `<div class="bg-white p-6 rounded-lg w-96 animate-fade-in"><h3 class="font-semibold">${q.title} (${idx+1}/${q.questions.length})</h3><div class="my-3">${qu.text}</div><div class="space-y-2 mb-4">${qu.options.map(o=>`<div><label><input type="radio" name="opt" value="${o}"> ${o}</label></div>`).join('')}</div><div class="flex justify-between"><button id="prev" class="px-3 py-1 bg-gray-200 rounded">Prev</button><div><button id="submit" class="px-3 py-1 bg-indigo-600 text-white rounded">Submit</button><button id="close" class="px-3 py-1 bg-gray-200 rounded">Close</button></div></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('#close').addEventListener('click', ()=>{ document.body.removeChild(modal); });
        modal.querySelector('#prev').addEventListener('click', ()=>{ if(idx>0){ idx--; document.body.removeChild(modal); render(); } });
        modal.querySelector('#submit').addEventListener('click', ()=>{ const sel = modal.querySelector('input[name="opt"]:checked'); const ans = sel? sel.value : null; if(ans && ans === qu.answer) score++; idx++; document.body.removeChild(modal); if(idx>=q.questions.length){ const u = DB.users.list()[0]; u.coins = (u.coins||0) + Math.round(score/q.questions.length*5); DB.users.update(u.id, {coins: u.coins}); this.populateCoins(); showResult(); } else render(); });
      };
      render();
    },

    renderStore(){
      const wrap = document.createElement('div'); wrap.className='p-6';
      const products = [
        { id:'prod_avatar_1', type:'avatar', title:'Vibrant Avatar Pack', price:10, img:'https://placehold.co/200x120/7C3AED/FFFFFF?text=Avatars', desc:'6 stylish avatars to personalize your profile.' },
        { id:'prod_banner_1', type:'banner', title:'Gradient Banner', price:8, img:'https://placehold.co/400x120/4F46E5/FFFFFF?text=Banner', desc:'A premium gradient banner for your profile header.' },
        { id:'prod_badge_1', type:'badge', title:'Achievement Badge', price:5, img:'https://placehold.co/120x120/10B981/FFFFFF?text=Badge', desc:'Earn this badge for completing challenges.' },
        { id:'prod_theme_1', type:'theme', title:'Midnight Theme', price:12, img:'https://placehold.co/200x120/111827/FFFFFF?text=Theme', desc:'A dark theme to reduce eye strain.' }
      ];

      wrap.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-semibold">Store</h2>
            <p class="text-sm text-gray-500">Customize your profile and unlock rewards using coins.</p>
          </div>
          <div class="text-sm text-gray-600">Your coins: <strong id="store-coins">0</strong></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${products.map(p=>`
            <div class="bg-white rounded-xl p-4 card-shadow hover:shadow-lg transition transform hover:-translate-y-1">
              <img src="${p.img}" alt="${p.title}" class="w-full h-36 object-cover rounded-lg mb-3">
              <div class="flex items-start justify-between">
                <div>
                  <div class="font-medium text-lg">${p.title}</div>
                  <div class="text-sm text-gray-500">${p.desc}</div>
                </div>
                <div class="text-right">
                  <div class="text-indigo-600 font-semibold">${p.price} coins</div>
                  <div class="text-xs text-gray-400">one-time</div>
                </div>
              </div>
              <div class="mt-3 flex items-center space-x-2">
                <button data-id="${p.id}" class="preview-btn px-3 py-2 bg-gray-100 rounded">Preview</button>
                <button data-price="${p.price}" data-id="${p.id}" class="buy-btn ml-auto px-3 py-2 bg-indigo-600 text-white rounded">Buy</button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- preview modal root -->
        <div id="store-modal-root"></div>
      `;

      setTimeout(()=>{
        // populate coin display
        const sc = document.getElementById('store-coins'); if(sc){ const u=DB.users.list()[0]; sc.textContent = (u.coins||0); }

        // preview handlers
        wrap.querySelectorAll('.preview-btn').forEach(btn=> btn.addEventListener('click', (e)=>{
          const id = btn.dataset.id; const p = products.find(x=>x.id===id); if(!p) return;
          const root = document.getElementById('store-modal-root'); root.innerHTML = '';
          const m = document.createElement('div'); m.className='fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50';
          m.innerHTML = `<div class="bg-white rounded-lg p-6 w-96">
            <div class="flex justify-between items-start"><div><h3 class="font-semibold">${p.title}</h3><div class="text-sm text-gray-500">${p.desc}</div></div><button id="close-pre" class="text-gray-500">✕</button></div>
            <div class="mt-4"><img src="${p.img}" alt="${p.title}" class="w-full rounded mb-3"></div>
            <div class="flex justify-end"><button id="buy-pre" class="px-4 py-2 bg-indigo-600 text-white rounded">Buy for ${p.price} coins</button></div>
          </div>`;
          root.appendChild(m);
          m.querySelector('#close-pre').addEventListener('click', ()=> root.innerHTML='');
          m.querySelector('#buy-pre').addEventListener('click', ()=>{ m.remove(); const u=DB.users.list()[0]; if((u.coins||0) < p.price) return alert('Not enough coins'); u.coins -= p.price; DB.users.update(u.id, {coins: u.coins}); this.populateCoins(); if(sc) sc.textContent = u.coins; alert('Purchased '+p.title); });
        }));

        // buy handlers on grid
        wrap.querySelectorAll('.buy-btn').forEach(b=> b.addEventListener('click', ()=>{
          const price = Number(b.dataset.price); const id = b.dataset.id; const u = DB.users.list()[0]; if((u.coins||0) < price) return alert('Not enough coins'); u.coins -= price; DB.users.update(u.id, {coins: u.coins}); this.populateCoins(); const t = document.createElement('div'); t.className='fixed bottom-6 right-6 bg-indigo-600 text-white px-4 py-2 rounded shadow'; t.textContent = 'Purchased!'; document.body.appendChild(t); setTimeout(()=>t.remove(),1800);
        }));
      },20);

      return wrap;
    },

    renderLeaderboard(){
      const wrap = document.createElement('div'); wrap.className='p-6';

      wrap.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-semibold">Leaderboard</h2>
            <p class="text-sm text-gray-500">See who's top in study time, coins, quizzes and average scores.</p>
          </div>
          <div class="flex items-center space-x-2">
            <label class="text-sm text-gray-500">Sort by</label>
            <select id="lb-filter" class="border p-2 rounded">
              <option value="studyTime">Study Time</option>
              <option value="coins">Coins</option>
              <option value="quizzes">Quizzes Taken</option>
              <option value="avgScore">Avg Quiz Score</option>
              <option value="streak">Streak</option>
            </select>
          </div>
        </div>

        <div id="lb-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
      `;

      const computeRows = ()=>{
        const users = DB.users.list();
        const sessions = DB.sessions.list();
        const attempts = DB.quizAttempts.list ? DB.quizAttempts.list() : [];

        // compute per-user aggregates
        return users.map(u=>{
          const userSessions = sessions.filter(s=>s.userId === u.id && s.completed);
          const totalStudyMs = userSessions.reduce((acc,s)=> acc + (s.duration||0), 0);
          const quizzes = attempts.filter(a=>a.userId === u.id);
          const quizzesTaken = quizzes.length;
          const avgScore = quizzesTaken ? Math.round((quizzes.reduce((acc,a)=> acc + (a.score/(a.total||1)), 0) / quizzesTaken) * 100) : 0;
          return Object.assign({}, u, { totalStudyMs, quizzesTaken, avgScore });
        });
      };

      const renderCard = (u, rank)=>{
        const hrs = Math.round(u.totalStudyMs/3600000);
        const card = document.createElement('div'); card.className = 'bg-white p-4 rounded-xl card-shadow flex items-center space-x-4 hover:shadow-lg transform hover:-translate-y-1 transition';
        card.innerHTML = `
          <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold" style="background:${u.avatarColor||'#6B21A8'}">${(u.name||'U').split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">${u.name}</div>
                <div class="text-xs text-gray-500">${u.badges && u.badges.length? u.badges.join(' • ') : 'Learner'}</div>
              </div>
              <div class="text-right text-sm text-gray-500">#${rank}</div>
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>⏱ Study: <strong class="text-gray-800">${hrs}h</strong></div>
              <div>🪙 Coins: <strong class="text-gray-800">${u.coins||0}</strong></div>
              <div>🧠 Quizzes: <strong class="text-gray-800">${u.quizzesTaken||0}</strong></div>
              <div>📈 Avg Score: <strong class="text-gray-800">${u.avgScore||0}%</strong></div>
            </div>
          </div>
        `;
        return card;
      };

      const refresh = ()=>{
        const root = wrap.querySelector('#lb-list'); if(!root) return;
        const rows = computeRows();
        const filter = wrap.querySelector('#lb-filter').value;
        let sorted = rows.slice();
        if(filter === 'studyTime') sorted.sort((a,b)=> (b.totalStudyMs||0) - (a.totalStudyMs||0));
        else if(filter === 'coins') sorted.sort((a,b)=> (b.coins||0) - (a.coins||0));
        else if(filter === 'quizzes') sorted.sort((a,b)=> (b.quizzesTaken||0) - (a.quizzesTaken||0));
        else if(filter === 'avgScore') sorted.sort((a,b)=> (b.avgScore||0) - (a.avgScore||0));
        else if(filter === 'streak') sorted.sort((a,b)=> (b.streak||0) - (a.streak||0));

        root.innerHTML = '';
        if(sorted.length===0) { root.innerHTML = '<div class="text-sm text-gray-500">No users yet.</div>'; return; }
        sorted.forEach((u,i)=> root.appendChild(renderCard(u, i+1)));
      };

      setTimeout(()=>{
        const sel = wrap.querySelector('#lb-filter'); if(sel) sel.addEventListener('change', refresh);
        refresh();
      },20);

      return wrap;
    },

    renderSettings(){
      const wrap = document.createElement('div'); wrap.className='p-6';
      const settings = DB.settings.get();
      const cur = DB.auth.current();
      wrap.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white p-6 rounded-xl card-shadow profile-card">
            <div class="flex items-center space-x-4 mb-4">
              <div id="profile-preview" class="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold" style="background:#7C3AED">JS</div>
              <div>
                <div id="profile-title" class="text-lg font-semibold">Profile</div>
                <div id="profile-sub" class="text-sm muted">Personal information & avatar</div>
              </div>
            </div>
            <div id="profile-area"></div>
          </div>
          <div class="bg-white p-6 rounded-xl card-shadow">
            <h2 class="text-lg font-semibold mb-4">Preferences</h2>
            <label class="block mb-2">Language<select id="set-lang" class="fancy-input w-full"><option value="en">English</option><option value="hi">हिन्दी</option></select></label>
            <button id="save-set" class="mt-2 fancy-btn">Save Preferences</button>
          </div>
          <div class="bg-white p-6 rounded-xl card-shadow">
            <h2 class="text-lg font-semibold mb-4">Account</h2>
            <div id="auth-area"></div>
          </div>
        </div>
      `;

      const renderProfileForm = () =>{
        const area = wrap.querySelector('#profile-area'); area.innerHTML = '';
        if(!cur){ area.innerHTML = '<div class="text-sm text-gray-500">Sign in to edit your profile.</div>'; return; }
        const html = `
          <div class="mb-2"><label class="text-sm">Full name</label><input id="pf-name" class="fancy-input w-full" value="${cur.name||''}" /></div>
          <div class="grid grid-cols-2 gap-2 mb-2"><div><label class="text-sm">Age</label><input id="pf-age" type="number" class="fancy-input w-full" value="${cur.age||''}" /></div><div><label class="text-sm">Gender</label><select id="pf-gender" class="fancy-input w-full"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></div></div>
          <div class="mb-2"><label class="text-sm">Mobile</label><input id="pf-mobile" class="fancy-input w-full" value="${cur.mobile||''}" /></div>
          <div class="mb-2"><label class="text-sm">Email</label><input id="pf-email" class="fancy-input w-full" value="${cur.email||''}" /></div>
          <div class="flex items-center justify-between mt-4"><div class="stat-pill">Streak: ${cur.streak||0}d</div><button id="pf-save" class="fancy-btn">Save Profile</button></div>
        `;
        area.innerHTML = html;
        const gsel = area.querySelector('#pf-gender'); if(gsel) gsel.value = cur.gender || '';
        area.querySelector('#pf-save').addEventListener('click', ()=>{
          const patch = { name: area.querySelector('#pf-name').value.trim(), age: Number(area.querySelector('#pf-age').value)||null, gender: area.querySelector('#pf-gender').value, mobile: area.querySelector('#pf-mobile').value.trim(), email: area.querySelector('#pf-email').value.trim() };
          DB.users.update(cur.id, patch);
          // update header & preview
          const pn = document.getElementById('profile-name'); if(pn) pn.textContent = patch.name || cur.name;
          const pp = document.getElementById('profile-preview'); if(pp) { pp.textContent = (patch.name||cur.name).split(' ').map(x=>x[0]).slice(0,2).join(''); pp.style.background = cur.avatarColor || '#7C3AED'; }
          const t = document.createElement('div'); t.className='fixed top-6 right-6 bg-indigo-600 text-white px-4 py-2 rounded shadow'; t.textContent = 'Profile saved'; document.body.appendChild(t); setTimeout(()=>t.remove(),1500);
        });
      };

      const renderAuthArea = ()=>{
        const a = wrap.querySelector('#auth-area'); a.innerHTML = '';
        if(cur){
          a.innerHTML = `<div class="flex items-center justify-between"><div><div class="text-sm text-gray-700 mb-1">Signed in as <strong>${cur.name}</strong></div><div class="text-xs muted">${cur.email||''}</div></div><button id="signout" class="px-3 py-2 bg-red-500 text-white rounded">Sign Out</button></div>`;
          a.querySelector('#signout').addEventListener('click', ()=>{ DB.auth.signOut(); const t = document.createElement('div'); t.className='fixed top-6 right-6 bg-gray-800 text-white px-4 py-2 rounded shadow'; t.textContent = 'Signed out'; document.body.appendChild(t); setTimeout(()=>t.remove(),1500); this.renderView('settings'); this.populateCoins(); const pn = document.getElementById('profile-name'); if(pn) pn.textContent = 'Guest'; });
        } else {
          a.innerHTML = `
            <div class="text-sm text-gray-500 mb-3">Sign in to sync your progress and access your profile.</div>
            <input id="si-email" placeholder="Email" class="fancy-input w-full mb-2" />
            <input id="si-pass" placeholder="Password" type="password" class="fancy-input w-full mb-2" />
            <div class="flex items-center space-x-2">
              <button id="btn-signin" class="fancy-btn">Sign In</button>
              <button id="btn-signup" class="px-3 py-2 bg-white border rounded">Sign Up</button>
            </div>
          `;
          a.querySelector('#btn-signin').addEventListener('click', ()=>{
            const em = a.querySelector('#si-email').value.trim(); const pw = a.querySelector('#si-pass').value; if(!em||!pw) return alert('Enter email & password');
            const u = DB.auth.signIn(em,pw); if(!u) return alert('Invalid credentials'); const t = document.createElement('div'); t.className='fixed top-6 right-6 bg-indigo-600 text-white px-4 py-2 rounded shadow'; t.textContent = 'Welcome back, '+u.name; document.body.appendChild(t); setTimeout(()=>t.remove(),1500); this.renderView('settings'); this.populateCoins(); const pn = document.getElementById('profile-name'); if(pn) pn.textContent = u.name;
          });
          a.querySelector('#btn-signup').addEventListener('click', ()=>{
            const em = a.querySelector('#si-email').value.trim(); const pw = a.querySelector('#si-pass').value; if(!em||!pw) return alert('Enter email & password');
            const user = { name: em.split('@')[0], email: em, password: pw, coins:0, streak:0, badges:[] };
            const created = DB.auth.signUp(user); if(!created) return alert('Account exists'); const t = document.createElement('div'); t.className='fixed top-6 right-6 bg-green-600 text-white px-4 py-2 rounded shadow'; t.textContent = 'Account created — signed in as '+created.name; document.body.appendChild(t); setTimeout(()=>t.remove(),1800); this.renderView('settings'); this.populateCoins(); const pn = document.getElementById('profile-name'); if(pn) pn.textContent = created.name;
          });
        }
      };

      setTimeout(()=>{
        // populate language
        wrap.querySelector('#set-lang').value = settings.language || 'en';
        wrap.querySelector('#save-set').addEventListener('click', ()=>{ DB.settings.update({language: wrap.querySelector('#set-lang').value}); alert('Saved'); });

        renderAuthArea();
        // if signed in show profile form
        if(DB.auth.current()) renderProfileForm();
      },20);

      return wrap;
    },

  populateCoins(){ const u = (DB.auth && DB.auth.current()) || DB.users.list()[0]; const el = document.getElementById('coins'); if(el) el.textContent = (u && u.coins) ? u.coins : 0; const pn = document.getElementById('profile-name'); if(pn) pn.textContent = (u && u.name) ? u.name : 'Guest'; const pa = document.getElementById('profile-avatar'); if(pa && u && u.name){ pa.src = `https://placehold.co/40x40/${u.avatarColor?u.avatarColor.replace('#',''): '4F46E5'}/FFFFFF?text=${encodeURIComponent(u.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}`; } },

    bindLanguage(){ const sel = document.getElementById('lang-select'); if(sel) sel.addEventListener('change', (e)=>{ DB.settings.update({language: e.target.value}); alert('Language set to '+e.target.value); }); },

    bindOfflineToggle(){ const btn = document.getElementById('btn-offline'); if(btn) btn.addEventListener('click', ()=>{ alert('This demo supports offline caching via Service Worker. Try disabling network in devtools.'); }); }

    ,bindGlobalSignOut(){
      const btn = document.getElementById('signout-global');
      if(!btn) return;
      btn.addEventListener('click', ()=>{
        try{
          DB.auth.signOut();
        }catch(e){ console.warn('Sign out failed', e); }
        // update UI
        this.populateCoins();
        // if currently on settings, re-render to show signed-out state
        const curView = document.querySelector('.nav-btn.active') ? document.querySelector('.nav-btn.active').dataset.view : 'dashboard';
        if(curView === 'settings') this.renderView('settings');
        // small toast
        const t = document.createElement('div'); t.className='fixed top-3 right-20 bg-gray-800 text-white px-3 py-1 rounded shadow'; t.textContent='Signed out'; document.body.appendChild(t); setTimeout(()=>t.remove(),1400);
      });
    }
  };

  window.App = App;
})();
 
