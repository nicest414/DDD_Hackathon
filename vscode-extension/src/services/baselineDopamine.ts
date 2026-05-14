import { DecisionCard, Decision, GeneratedApp } from '../models/types';

const MOCK_CARDS: Omit<DecisionCard, 'projectId' | 'status'>[] = [
  {
    id: 'mock-1', type: 'feature',
    title: '習慣の登録・管理',
    description: 'ユーザーが習慣を名前・頻度・カテゴリで登録できます。',
    payload: {}, predictedReward: 'アプリの基本機能が揃います',
    noveltyScore: 0.8, effortScore: 0.5,
  },
  {
    id: 'mock-2', type: 'feature',
    title: '今日の達成チェック',
    description: 'ホーム画面に今日の習慣を一覧表示し、タップで達成マークをつけられます。',
    payload: {}, predictedReward: '毎日の操作の中心になります',
    noveltyScore: 0.7, effortScore: 0.4,
  },
  {
    id: 'mock-3', type: 'feature',
    title: '連続達成日数（ストリーク）',
    description: '何日連続で達成できているかをカウント表示します。',
    payload: {}, predictedReward: '継続意欲が上がります',
    noveltyScore: 0.9, effortScore: 0.6,
  },
  {
    id: 'mock-4', type: 'ui',
    title: '週間グラフ',
    description: '達成率をグラフで可視化します。',
    payload: {}, predictedReward: '振り返りがしやすくなります',
    noveltyScore: 0.6, effortScore: 0.7,
  },
  {
    id: 'mock-5', type: 'feature',
    title: 'リマインダー通知',
    description: '習慣ごとに好きな時間にプッシュ通知を設定できます。',
    payload: {}, predictedReward: '継続率が上がります',
    noveltyScore: 0.7, effortScore: 0.8,
  },
  {
    id: 'mock-6', type: 'ui',
    title: 'ダークモード対応',
    description: 'システム設定に応じて自動でダーク/ライトを切り替えます。',
    payload: {}, predictedReward: '視認性が向上します',
    noveltyScore: 0.4, effortScore: 0.3,
  },
];

export class BaselineDopamine {
  getNextCard(projectId: string, decisions: Decision[]): DecisionCard | null {
    const usedIds = new Set(decisions.map((d) => d.cardId));
    const next = MOCK_CARDS.find((c) => !usedIds.has(c.id));
    if (!next) { return null; }
    return { ...next, projectId, status: 'pending' };
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
      source: '// TODO: generated source',
      previewState: {},
      repositoryUrl: '',
      branchName: '',
      pullRequestUrl: '',
      updatedAt: new Date().toISOString(),
    };
  }
}
