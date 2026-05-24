import { DecisionCard, Decision, GeneratedApp, Project } from '../models/types';
import { AIRuntimeAdapter, AIRuntimeConnectionResult, AIRuntimeProvider } from './ai/aiRuntime';

type BaselineCard = Omit<DecisionCard, 'projectId' | 'status'>;

const MOCK_CARDS: BaselineCard[] = [
  {
    id: 'mock-1', type: 'moment',
    title: '習慣の登録・管理',
    hook: '続けたいことを迷わず1分でセットできます。',
    description: 'ユーザーが習慣を名前・頻度・カテゴリで登録できます。',
    payoff: '始めた瞬間に、自分専用の習慣リストが育ち始めます。',
    acceptLabel: 'これ欲しい',
    rejectLabel: '今はいらない',
    payload: {}, predictedReward: 'アプリの基本機能が揃います',
    noveltyScore: 0.8, effortScore: 0.5, dopamineScore: 0.7,
  },
  {
    id: 'mock-2', type: 'reward',
    title: '今日の達成チェック',
    hook: '今日やることが開いた瞬間に見えます。',
    description: 'ホーム画面に今日の習慣を一覧表示し、タップで達成マークをつけられます。',
    payoff: 'ワンタップで今日の前進が記録され、達成感がすぐ返ってきます。',
    acceptLabel: '入れたい',
    rejectLabel: '後でいい',
    payload: {}, predictedReward: '毎日の操作の中心になります',
    noveltyScore: 0.7, effortScore: 0.4, dopamineScore: 0.9,
  },
  {
    id: 'mock-3', type: 'reward',
    title: '連続達成日数（ストリーク）',
    hook: '続いている自分が数字で見えます。',
    description: '何日連続で達成できているかをカウント表示します。',
    payoff: '途切れさせたくない気持ちが自然に生まれます。',
    acceptLabel: '燃える',
    rejectLabel: '不要',
    payload: {}, predictedReward: '継続意欲が上がります',
    noveltyScore: 0.9, effortScore: 0.6, dopamineScore: 0.95,
  },
  {
    id: 'mock-4', type: 'polish',
    title: '週間グラフ',
    hook: '1週間の頑張りがひと目でわかります。',
    description: '達成率をグラフで可視化します。',
    payoff: '振り返るたびに次も続けようと思えます。',
    acceptLabel: '見たい',
    rejectLabel: 'いらない',
    payload: {}, predictedReward: '振り返りがしやすくなります',
    noveltyScore: 0.6, effortScore: 0.7, dopamineScore: 0.65,
  },
  {
    id: 'mock-5', type: 'risk',
    title: 'リマインダー通知',
    hook: '忘れる前にやさしく背中を押します。',
    description: '習慣ごとに好きな時間にプッシュ通知を設定できます。',
    payoff: '忙しい日でも習慣が生活の流れから消えにくくなります。',
    acceptLabel: '助かる',
    rejectLabel: '通知は不要',
    payload: {}, predictedReward: '継続率が上がります',
    noveltyScore: 0.7, effortScore: 0.8, dopamineScore: 0.75,
  },
  {
    id: 'mock-6', type: 'polish',
    title: 'ダークモード対応',
    hook: '夜でも気持ちよく開けます。',
    description: 'システム設定に応じて自動でダーク/ライトを切り替えます。',
    payoff: '毎日使う画面のストレスが小さくなります。',
    acceptLabel: '整えたい',
    rejectLabel: '後回し',
    payload: {}, predictedReward: '視認性が向上します',
    noveltyScore: 0.4, effortScore: 0.3, dopamineScore: 0.5,
  },
  {
    id: 'mock-7', type: 'flow',
    title: '初回オンボーディング',
    hook: '最初の30秒で使い方と価値が伝わります。',
    description: '初回起動時に、習慣の作り方と達成チェックの流れを短く案内します。',
    payoff: '始める前の迷いが減り、最初の習慣登録まで進みやすくなります。',
    acceptLabel: '入れたい',
    rejectLabel: 'すぐ始めたい',
    payload: {}, predictedReward: '初回離脱を減らします',
    noveltyScore: 0.5, effortScore: 0.4, dopamineScore: 0.6,
  },
  {
    id: 'mock-8', type: 'data',
    title: 'カテゴリ別の習慣整理',
    hook: '生活、仕事、健康を分けて見渡せます。',
    description: '習慣にカテゴリを設定し、一覧画面で絞り込みできるようにします。',
    payoff: '習慣が増えても、今見たいものだけに集中できます。',
    acceptLabel: '整理したい',
    rejectLabel: 'シンプルでいい',
    payload: {}, predictedReward: '長く使っても破綻しにくくなります',
    noveltyScore: 0.6, effortScore: 0.5, dopamineScore: 0.65,
  },
  {
    id: 'mock-9', type: 'moment',
    title: '達成時の小さな祝福',
    hook: 'チェックした瞬間に気持ちいい反応が返ります。',
    description: '達成マークを付けたときに短いアニメーションとメッセージを表示します。',
    payoff: '毎日のチェックが作業ではなく、少し嬉しい瞬間になります。',
    acceptLabel: '欲しい',
    rejectLabel: '静かでいい',
    payload: {}, predictedReward: '操作の報酬感が上がります',
    noveltyScore: 0.7, effortScore: 0.3, dopamineScore: 0.85,
  },
  {
    id: 'mock-10', type: 'risk',
    title: '失敗日のリカバリー',
    hook: '途切れても戻ってこられる余白を作ります。',
    description: '未達成の日があっても、翌日に再開しやすい励ましや再計画を表示します。',
    payoff: '一度の失敗でアプリを開かなくなるリスクを下げます。',
    acceptLabel: '大事',
    rejectLabel: '不要',
    payload: {}, predictedReward: '継続体験が折れにくくなります',
    noveltyScore: 0.8, effortScore: 0.5, dopamineScore: 0.8,
  },
];

function clampScore(score: number): number {
  if (!Number.isFinite(score)) { return 0.5; }
  return Math.min(1, Math.max(0, score));
}

function normalizeCard(card: BaselineCard, projectId: string): DecisionCard {
  return {
    ...card,
    projectId,
    payload: card.payload && typeof card.payload === 'object' && !Array.isArray(card.payload)
      ? card.payload
      : {},
    noveltyScore: clampScore(card.noveltyScore),
    effortScore: clampScore(card.effortScore),
    dopamineScore: clampScore(card.dopamineScore),
    status: 'pending',
  };
}

export class BaselineDopamine implements AIRuntimeAdapter {
  async testConnection(provider: AIRuntimeProvider): Promise<AIRuntimeConnectionResult> {
    return {
      ok: true,
      provider,
      message: 'Baseline mock is available.',
    };
  }

  async generateNextCard(
    project: Project,
    decisions: Decision[],
    _accepted: DecisionCard[],
    _rejected: DecisionCard[],
    existingCards: DecisionCard[] = [],
  ): Promise<DecisionCard | null> {
    return this.getNextCard(project.id, decisions, existingCards);
  }

  async generateCardBatch(
    project: Project,
    decisions: Decision[],
    _accepted: DecisionCard[],
    _rejected: DecisionCard[],
    existingCards: DecisionCard[] = [],
    count: number,
  ): Promise<DecisionCard[]> {
    const cards: DecisionCard[] = [];
    const draftExisting = [...existingCards];
    for (let i = 0; i < count; i++) {
      const card = this.getNextCard(project.id, decisions, draftExisting);
      if (!card) { break; }
      cards.push(card);
      draftExisting.push(card);
    }
    return cards;
  }

  async generateApp(project: Project, _acceptedCards: DecisionCard[]): Promise<GeneratedApp> {
    return this.getMockApp(project.id);
  }

  getNextCard(projectId: string, decisions: Decision[], existingCards: DecisionCard[] = []): DecisionCard | null {
    const usedIds = new Set([
      ...decisions.map((d) => d.cardId),
      ...existingCards.map((c) => c.id),
    ]);
    const next = MOCK_CARDS.find((c) => !usedIds.has(c.id));
    if (!next) { return null; }
    return normalizeCard(next, projectId);
  }

  getMockApp(projectId: string): GeneratedApp {
    return {
      id: `app-${projectId}`,
      projectId,
      spec: {
        name: 'Habit Tracker',
        summary: '毎日の習慣を登録し、達成状況を記録するミニアプリ',
        screens: [{ name: 'Home', description: '習慣一覧と今日の達成状況を表示する' }],
        features: ['習慣登録', '今日の達成チェック', '連続達成日数の表示'],
      },
      source: `import './styles.css';

const storageKey = 'ddd-habit-tracker';
const defaultHabits = [
  { id: 'reading', name: '読書', streak: 3, doneToday: false, lastDoneDate: '' },
  { id: 'stretch', name: 'ストレッチ', streak: 1, doneToday: true, lastDoneDate: todayKey() },
];

let habits = loadHabits();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createHabitId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(16).slice(2, 10);
}

function normalizeHabit(habit) {
  const lastDoneDate = typeof habit.lastDoneDate === 'string'
    ? habit.lastDoneDate
    : habit.doneToday ? todayKey() : '';
  return {
    id: typeof habit.id === 'string' ? habit.id : createHabitId(),
    name: typeof habit.name === 'string' ? habit.name : '新しい習慣',
    streak: Number.isFinite(Number(habit.streak)) ? Number(habit.streak) : 0,
    doneToday: lastDoneDate === todayKey(),
    lastDoneDate,
  };
}

function loadHabits() {
  try {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? JSON.parse(saved) : defaultHabits;
    return Array.isArray(parsed) ? parsed.map(normalizeHabit) : defaultHabits.map(normalizeHabit);
  } catch {
    return defaultHabits.map(normalizeHabit);
  }
}

function saveHabits() {
  localStorage.setItem(storageKey, JSON.stringify(habits));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function render() {
  const completed = habits.filter((habit) => habit.doneToday).length;
  document.querySelector('#app').innerHTML = \`
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">Habit Tracker</p>
        <h1>今日の習慣</h1>
        <p class="summary">\${completed} / \${habits.length} 件を今日達成しています。</p>
      </section>

      <form class="workspace" id="habit-form">
        <input name="name" aria-label="習慣名" placeholder="新しい習慣を入力" />
        <button class="task-state" type="submit">追加</button>
      </form>

      <section class="workspace">
        \${habits.map((habit) => \`
          <article class="task \${habit.doneToday ? 'done' : ''}">
            <span class="task-copy">
              <strong>\${escapeHtml(habit.name)}</strong>
              <small>連続 \${habit.streak} 日</small>
            </span>
            <button class="task-state" type="button" data-id="\${habit.id}">
              \${habit.doneToday ? '達成済み' : '達成する'}
            </button>
          </article>
        \`).join('')}
      </section>
    </main>
  \`;

}

function addHabit(name) {
  habits = [{ id: createHabitId(), name: name.trim(), streak: 0, doneToday: false, lastDoneDate: '' }, ...habits];
  saveHabits();
  render();
}

function toggleHabit(id) {
  const today = todayKey();
  habits = habits.map((habit) => {
    if (habit.id !== id) { return habit; }
    if (habit.doneToday) {
      return {
        ...habit,
        doneToday: false,
        lastDoneDate: '',
        streak: habit.lastDoneDate === today ? Math.max(0, habit.streak - 1) : habit.streak,
      };
    }
    return {
      ...habit,
      doneToday: true,
      lastDoneDate: today,
      streak: habit.lastDoneDate === today ? habit.streak : habit.streak + 1,
    };
  });
  saveHabits();
  render();
}

function initialize() {
  const app = document.querySelector('#app');
  app?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) { return; }
    const name = new FormData(form).get('name');
    if (typeof name !== 'string' || !name.trim()) { return; }
    addHabit(name);
  });

  app?.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-id]') : null;
    if (!(button instanceof HTMLElement)) { return; }
    toggleHabit(button.dataset.id || '');
  });
}

initialize();
render();`,
      previewState: {},
      repositoryUrl: '',
      branchName: '',
      pullRequestUrl: '',
      updatedAt: new Date().toISOString(),
    };
  }
}
