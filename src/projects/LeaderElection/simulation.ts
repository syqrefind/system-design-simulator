import { DiagramModelManager } from '../../layers/layer2/DiagramModel';

// ─── Raft Leader Election: Diagram Model ──────────────────────────────────────
// 5-node Raft cluster in a circular topology.

export const RAFT_NODE_IDS = ['raft-0', 'raft-1', 'raft-2', 'raft-3', 'raft-4'];

export function buildRaftModel(): DiagramModelManager {
  const mgr = new DiagramModelManager(
    'Raft Leader Election',
    '5-node Raft consensus cluster — election timers, voting, leader heartbeats',
  );

  // Arrange nodes in a circle
  const cx = 420;
  const cy = 310;
  const radius = 190;

  RAFT_NODE_IDS.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / RAFT_NODE_IDS.length - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    mgr.addNamedNode(id, 'server', `S${i}`, { x: Math.round(x), y: Math.round(y) }, 'follower', { index: i });
  });

  // Fully connected peer edges
  for (let i = 0; i < RAFT_NODE_IDS.length; i++) {
    for (let j = i + 1; j < RAFT_NODE_IDS.length; j++) {
      mgr.addEdge(RAFT_NODE_IDS[i], RAFT_NODE_IDS[j], 'async', undefined, true);
    }
  }

  return mgr;
}

// ─── Raft Explanations ────────────────────────────────────────────────────────

export const RAFT_EXPLAINERS = [
  {
    phase: 'Follower',
    text: 'Each server starts as a follower with a randomized election timeout (150–300ms).',
    color: '#4facfe',
  },
  {
    phase: 'Candidate',
    text: 'When the timeout fires, the follower increments its term, votes for itself, and broadcasts RequestVote RPCs.',
    color: '#f6ad55',
  },
  {
    phase: 'Leader',
    text: 'The first server to collect a majority of votes becomes the leader and sends periodic heartbeats to suppress new elections.',
    color: '#ffd700',
  },
  {
    phase: 'Heartbeat',
    text: 'The leader sends AppendEntries RPCs (heartbeats) to all followers, resetting their election timers.',
    color: '#48bb78',
  },
];
