"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaselineDopamine = void 0;
const MOCK_CARDS = [
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
];
function clampScore(score) {
    if (!Number.isFinite(score)) {
        return 0.5;
    }
    return Math.min(1, Math.max(0, score));
}
function normalizeCard(card, projectId) {
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
class BaselineDopamine {
    async generateNextCard(project, decisions, _accepted, _rejected) {
        return this.getNextCard(project.id, decisions);
    }
    async generateApp(project, _acceptedCards) {
        return this.getMockApp(project.id);
    }
    getNextCard(projectId, decisions) {
        const usedIds = new Set(decisions.map((d) => d.cardId));
        const next = MOCK_CARDS.find((c) => !usedIds.has(c.id));
        if (!next) {
            return null;
        }
        return normalizeCard(next, projectId);
    }
    getMockApp(projectId) {
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
exports.BaselineDopamine = BaselineDopamine;
//# sourceMappingURL=baselineDopamine.js.map