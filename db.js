/* Simple client-side DB using localStorage for demo purposes.
   Provides CRUD for users, subjects, flashcards, quizzes, sessions, leaderboards.
*/
(function(){
  const KEY = 'eduai_v1';
  const DEFAULT = {
    users: [
      {id: 'u1', name: 'Alex Morgan', age:29, gender:'male', mobile:'+1-555-0101', email:'alex.morgan@example.com', password:'pass123', bio:'Calculus enthusiast and long-run learner.', institution:'Northview University', location:'Seattle, WA', coins: 50, streak:14, badges:['top-scorer','marathon'], avatarColor: '#0ea5a4'},
      {id: 'u2', name: 'Sofia Reyes', age:26, gender:'female', mobile:'+1-555-0102', email:'sofia.reyes@example.com', password:'pass123', bio:'Loves problem solving and algorithms.', institution:'BayTech College', location:'San Francisco, CA', coins: 42, streak:11, badges:['consistent'], avatarColor: '#7c3aed'},
      {id: 'u3', name: 'Noah Smith', age:22, gender:'male', mobile:'+1-555-0103', email:'noah.smith@example.com', password:'pass123', bio:'Preparing for programming contests.', institution:'State University', location:'Austin, TX', coins: 36, streak:9, badges:['quiz-winner'], avatarColor: '#059669'},
      {id: 'u4', name: 'Emma Johnson', age:24, gender:'female', mobile:'+1-555-0104', email:'emma.johnson@example.com', password:'pass123', bio:'Data structures and systems student.', institution:'Central Institute', location:'Chicago, IL', coins: 30, streak:7, badges:['fast-learner'], avatarColor: '#f97316'},
      {id: 'u5', name: 'Liam Chen', age:21, gender:'male', mobile:'+1-555-0105', email:'liam.chen@example.com', password:'pass123', bio:'Interested in algorithms and ML basics.', institution:'Metro College', location:'New York, NY', coins: 24, streak:5, badges:[], avatarColor: '#fb7185'},
      {id: 'u6', name: 'Olivia Brown', age:28, gender:'female', mobile:'+1-555-0106', email:'olivia.brown@example.com', password:'pass123', bio:'Applied mathematics background.', institution:'Lakeside University', location:'Seattle, WA', coins: 18, streak:4, badges:[], avatarColor: '#2563eb'},
      {id: 'u7', name: 'Ethan Wilson', age:20, gender:'male', mobile:'+1-555-0107', email:'ethan.wilson@example.com', password:'pass123', bio:'Freshman exploring CS fundamentals.', institution:'Westfield College', location:'Denver, CO', coins: 12, streak:3, badges:['starter'], avatarColor: '#ef4444'},
      {id: 'u8', name: 'Aisha Khan', age:23, gender:'female', mobile:'+1-555-0108', email:'aisha.khan@example.com', password:'pass123', bio:'Strong interest in algorithms and DS.', institution:'City University', location:'Houston, TX', coins: 9, streak:2, badges:[], avatarColor: '#059669'},
      {id: 'u9', name: 'Ravi Patel', age:27, gender:'male', mobile:'+1-555-0109', email:'ravi.patel@example.com', password:'pass123', bio:'Developer and lifelong learner.', institution:'Tech Institute', location:'Chicago, IL', coins: 6, streak:1, badges:[], avatarColor: '#f59e0b'},
      {id: 'u10', name: 'Maya Li', age:25, gender:'female', mobile:'+1-555-0110', email:'maya.li@example.com', password:'pass123', bio:'Passionate about teaching and tutoring.', institution:'Northview University', location:'Seattle, WA', coins: 4, streak:1, badges:[], avatarColor: '#1e293b'}
    ],
    subjects: [
      {id: 's1', name: 'Calculus', lang: 'en'},
      {id: 's2', name: 'Data Structures', lang: 'en'}
    ],
    flashcards: [],
    quizzes: [],
    cheatsheets: [],
  sessions: [],
    quizAttempts: [],
  currentUserId: 'u1',
    // demo leaderboards array kept for compatibility but leaderboard will be computed dynamically
    leaderboards: [],
    settings: {language: 'en'}
  };

  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      const state = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT));
      // migration: if existing state is missing some seeded users (or seeded data changed), merge defaults
      try{
        if(state && Array.isArray(state.users) && Array.isArray(DEFAULT.users) && state.users.length < DEFAULT.users.length){
          const have = new Set(state.users.map(u=>u.id));
          DEFAULT.users.forEach(u=>{ if(!have.has(u.id)) state.users.push(u); });
        }
        // if there's no currentUserId in an existing state, set it to the demo default so profile UI shows
        if(typeof state.currentUserId === 'undefined' || state.currentUserId === null){
          state.currentUserId = DEFAULT.currentUserId || (state.users[0] && state.users[0].id) || null;
        }
      }catch(e){ console.warn('DB migration check failed', e); }
      // seed demo sessions and quiz attempts if none exist (or add missing sessions for newly added users)
      if(!Array.isArray(state.sessions)) state.sessions = [];
      if(!Array.isArray(state.quizAttempts)) state.quizAttempts = [];

      if((state.sessions||[]).length === 0){
        const now = Date.now();
        // create descending study time by allocating larger durations to earlier users
        const userOrder = ['u1','u2','u3','u4','u5','u6','u7','u8','u9','u10'];
        state.sessions = [];
        // for each user, create several sessions that sum to descending totals
        const baseHours = [40, 32, 26, 20, 16, 12, 8, 6, 4, 2]; // hours per user roughly descending
        userOrder.forEach((uid, idx)=>{
          const hrs = baseHours[idx];
          // split into a few sessions
          const parts = Math.max(1, Math.floor(hrs/4));
          for(let p=0;p<parts;p++){
            const durationMs = Math.round((hrs/parts) * 60 * 60 * 1000);
            state.sessions.push({ id: `sess_${uid}_${p}`, userId: uid, subjectId: (p%2===0? 's1':'s2'), title: `Study block ${p+1}`, scheduled: now - (idx+1+p)*24*3600*1000, duration: durationMs, completed:true });
          }
        });
      }
      else {
        // if some users were newly added, ensure at least one session exists per user
        const now = Date.now();
        const baseHours = [40, 32, 26, 20, 16, 12, 8, 6, 4, 2];
        const userOrder = (DEFAULT.users||[]).map(u=>u.id);
        userOrder.forEach((uid, idx)=>{
          const has = (state.sessions||[]).some(s=>s.userId === uid);
          if(!has){
            const hrs = baseHours[idx] || 2;
            const parts = Math.max(1, Math.floor(hrs/4));
            for(let p=0;p<parts;p++){
              const durationMs = Math.round((hrs/parts) * 60 * 60 * 1000);
              state.sessions.push({ id: `sess_${uid}_m${p}`, userId: uid, subjectId: (p%2===0? 's1':'s2'), title: `Imported study block ${p+1}`, scheduled: now - (idx+2+p)*24*3600*1000, duration: durationMs, completed:true });
            }
          }
        });
      }

      if((state.quizAttempts||[]).length === 0){
        const now = Date.now();
        state.quizAttempts = [];
        // create a couple of quiz attempts per user with reasonable scores
        const sampleAttempts = [
          { userId:'u1', score:9, total:10 }, { userId:'u1', score:8, total:10 },
          { userId:'u2', score:8, total:10 }, { userId:'u2', score:7, total:10 },
          { userId:'u3', score:7, total:10 }, { userId:'u3', score:6, total:10 },
          { userId:'u4', score:6, total:10 }, { userId:'u4', score:6, total:10 },
          { userId:'u5', score:5, total:10 }, { userId:'u6', score:5, total:10 },
          { userId:'u7', score:4, total:10 }, { userId:'u8', score:3, total:10 },
          { userId:'u9', score:3, total:10 }, { userId:'u10', score:2, total:10 }
        ];
        sampleAttempts.forEach((a,i)=> state.quizAttempts.push({ id: `qa_demo_${i}`, quizId: `q_demo_${i}`, subjectId: (i%2===0?'s1':'s2'), userId: a.userId, score: a.score, total: a.total, timestamp: now - (i+1)*24*3600*1000 }));
      } else {
        // ensure at least one attempt per user if missing
        const now = Date.now();
        const defaultScores = { 'u1':[9,8], 'u2':[8,7], 'u3':[7,6], 'u4':[6,6], 'u5':[5], 'u6':[5], 'u7':[4], 'u8':[3], 'u9':[3], 'u10':[2] };
        const existingByUser = {};
        (state.quizAttempts||[]).forEach(a=>{ existingByUser[a.userId] = existingByUser[a.userId] || 0; existingByUser[a.userId]++; });
        Object.keys(defaultScores).forEach((uid)=>{
          if(!existingByUser[uid]){
            defaultScores[uid].forEach((sc, i)=> state.quizAttempts.push({ id:`qa_m_${uid}_${i}`, quizId:`q_m_${uid}_${i}`, subjectId: (i%2===0?'s1':'s2'), userId: uid, score: sc, total: 10, timestamp: now - (i+2)*24*3600*1000 }));
          }
        });
      }
      // ensure seeded state persisted
      localStorage.setItem(KEY, JSON.stringify(state));
      return state;
    }catch(e){
      console.error('DB read error', e);
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  }

  function write(state){
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){ console.error('DB write error', e); }
  }

  const DB = {
    getState(){ return read(); },
    saveState(s){ write(s); },

    // Authentication helpers (very simple, for demo only)
    auth: {
      current(){ const s = read(); return s.users.find(u=>u.id === s.currentUserId) || null; },
      signIn(email, password){ const s = read(); const u = s.users.find(x=> x.email === email && x.password === password); if(!u) return null; s.currentUserId = u.id; write(s); return u; },
      signOut(){ const s = read(); s.currentUserId = null; write(s); return true; },
      signUp(user){ const s = read(); if(s.users.find(x=> x.email === user.email)) return null; user.id = 'u_' + Math.random().toString(36).slice(2,8); s.users.push(user); s.currentUserId = user.id; write(s); return user; }
    },

    users: {
      list(){ return read().users; },
      get(id){ return read().users.find(u=>u.id===id); },
      update(id, patch){ const s=read(); const u=s.users.find(x=>x.id===id); if(!u) return null; Object.assign(u,patch); write(s); return u; },
      add(user){ const s=read(); s.users.push(user); write(s); return user; }
    },

    subjects: {
      list(){ return read().subjects; },
      add(subject){ const s=read(); s.subjects.push(subject); write(s); return subject; },
      update(id, patch){ const s=read(); const it=s.subjects.find(x=>x.id===id); if(!it) return null; Object.assign(it,patch); write(s); return it; },
      remove(id){ const s=read(); s.subjects = s.subjects.filter(x=>x.id!==id); write(s); }
    },

    flashcards: {
      list(){ return read().flashcards; },
      add(card){ const s=read(); s.flashcards.push(card); write(s); return card; },
      update(id, patch){ const s=read(); const it=s.flashcards.find(x=>x.id===id); if(!it) return null; Object.assign(it,patch); write(s); return it; },
      remove(id){ const s=read(); s.flashcards = s.flashcards.filter(x=>x.id!==id); write(s); }
    },

    cheatsheets: {
      list(){ return read().cheatsheets; },
      add(cs){ const s=read(); s.cheatsheets.push(cs); write(s); return cs; },
      update(id, patch){ const s=read(); const it=s.cheatsheets.find(x=>x.id===id); if(!it) return null; Object.assign(it,patch); write(s); return it; },
      remove(id){ const s=read(); s.cheatsheets = s.cheatsheets.filter(x=>x.id!==id); write(s); }
    },

    quizzes: {
      list(){ return read().quizzes; },
      add(q){ const s=read(); s.quizzes.push(q); write(s); return q; },
      update(id, patch){ const s=read(); const it=s.quizzes.find(x=>x.id===id); if(!it) return null; Object.assign(it,patch); write(s); return it; },
      remove(id){ const s=read(); s.quizzes = s.quizzes.filter(x=>x.id!==id); write(s); }
    },

    quizAttempts: {
      list(){ return read().quizAttempts; },
      add(at){ const s=read(); s.quizAttempts.push(at); write(s); return at; }
    },

    sessions: {
      list(){ return read().sessions; },
      add(sess){ const s=read(); s.sessions.push(sess); write(s); return sess; }
    },

    leaderboards: {
      list(){ return read().leaderboards; },
      update(list){ const s=read(); s.leaderboards = list; write(s); }
    },

    settings: {
      get(){ return read().settings; },
      update(patch){ const s=read(); Object.assign(s.settings,patch); write(s); }
    }
  };

  // Badge & streak helpers
  DB.users.awardBadge = function(userId, badge){ const s = read(); const u = s.users.find(x=>x.id===userId); if(!u) return null; u.badges = u.badges || []; if(!u.badges.includes(badge)) u.badges.push(badge); write(s); return u; };
  DB.users.incrementStreak = function(userId){ const s=read(); const u=s.users.find(x=>x.id===userId); if(!u) return null; u.streak = (u.streak||0)+1; u.lastStudy = Date.now(); write(s); return u; };
  DB.users.resetStreak = function(userId){ const s=read(); const u=s.users.find(x=>x.id===userId); if(!u) return null; u.streak = 0; write(s); return u; };

  // Expose
    window.DB = DB;
  })();
