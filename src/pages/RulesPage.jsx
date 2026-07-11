import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const Section = ({ title, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <h2 className="font-bold text-base text-foreground">{title}</h2>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-6 pb-5 border-t border-border pt-4 text-sm text-foreground space-y-2">{children}</div>}
    </div>
  );
};

const Rule = ({ children }) => (
  <li className="flex gap-2 text-sm">
    <span className="text-[hsl(142,50%,45%)] mt-0.5 font-bold flex-shrink-0">•</span>
    <span>{children}</span>
  </li>
);

const Bold = ({ children }) => <strong className="font-semibold">{children}</strong>;

export default function RulesPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 text-[hsl(217,72%,40%)]" />
          <h1 className="text-2xl font-bold">BreakPoint Ladders Official Rules</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          By participating in BreakPoint Ladders, you agree to follow these rules and uphold the highest standards of honesty, integrity, and sportsmanship.
        </p>
      </div>

      <div className="space-y-4">
        <Section title="Joining the Ladder">
          <ul className="space-y-2">
            <Rule>New players always begin at the <Bold>bottom of the ladder</Bold>.</Rule>
            <Rule>Players may participate only in the ladder(s) for which they are registered.</Rule>
            <Rule>Ladder rankings are determined solely by each player's position on the ladder.</Rule>
          </ul>
        </Section>

        <Section title="Subscription & Membership">
          <ul className="space-y-2">
            <Rule>Participation requires a <Bold>$25 subscription fee per season</Bold>.</Rule>
            <Rule>Each season lasts <Bold>four (4) months</Bold>.</Rule>
            <Rule>At the conclusion of each season, players may choose whether to renew their subscription.</Rule>
            <Rule>Players may renew <Bold>at any time after a season ends, before the start of the next season, or during the following season</Bold> while retaining their current ladder position.</Rule>
            <Rule>Players who do <Bold>not</Bold> renew and skip an entire season will be removed from the ladder.</Rule>
            <Rule>Players removed after missing an entire season may rejoin at any time by purchasing a new subscription; however, they will re-enter the ladder at the <Bold>bottom</Bold>.</Rule>
          </ul>
        </Section>

        <Section title="Seasons">
          <p className="text-sm text-muted-foreground mb-3">BreakPoint Ladders operates two competitive seasons each year.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-xl p-4">
              <p className="font-semibold text-sm">🌸 Spring Season</p>
              <p className="text-muted-foreground text-sm">March 1 – June 30</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
              <p className="font-semibold text-sm">☀️ Summer/Fall Season</p>
              <p className="text-muted-foreground text-sm">July 1 – October 31</p>
            </div>
          </div>
          <ul className="space-y-2 mt-3">
            <Rule>Win-loss records are reset at the conclusion of each season.</Rule>
            <Rule>Match history and player statistics are cleared each season.</Rule>
            <Rule>Each new season begins with returning players maintaining their ladder positions with fresh records.</Rule>
          </ul>
        </Section>

        <Section title="Challenge Rules — Eligible Challenges">
          <ul className="space-y-2">
            <Rule>Players may challenge opponents who are up to <Bold>10 positions above or below</Bold> their current ranking.</Rule>
            <Rule>Players may have <Bold>one pending challenge</Bold> (awaiting a response) and <Bold>one accepted challenge</Bold> (scheduled to be played) at the same time.</Rule>
            <Rule>A player <Bold>may not</Bold> issue another challenge while they already have a pending challenge awaiting a response.</Rule>
            <Rule>Players may issue a new challenge while they have one accepted challenge awaiting completion.</Rule>
            <Rule>Players may <Bold>not</Bold> challenge an opponent who currently has either a pending or accepted challenge.</Rule>
          </ul>
        </Section>

        <Section title="Challenge Rules — Responding, Declining & Cancelling">
          <ul className="space-y-2">
            <Rule>Challenged players have <Bold>48 hours</Bold> to accept or decline a challenge.</Rule>
            <Rule>Failure to respond within 48 hours results in an <Bold>automatic forfeit</Bold>, and the challenger is awarded the win.</Rule>
            <Rule>Every declined challenge must include a reason.</Rule>
            <Rule>A player may decline a challenge from the same opponent no more than <Bold>two consecutive times</Bold>.</Rule>
            <Rule>If a player declines a <Bold>third consecutive challenge</Bold> from the same opponent, the challenged player automatically forfeits the match.</Rule>
            <Rule>The challenger may <Bold>cancel a pending challenge</Bold> at any time before the opponent responds. No penalties apply.</Rule>
          </ul>
        </Section>

        <Section title="Scheduling Matches">
          <ul className="space-y-2">
            <Rule>Once a challenge has been accepted, players have <Bold>14 days</Bold> to complete the match.</Rule>
            <Rule>Players schedule matches through the <Bold>BreakPoint Ladders messaging system</Bold>. Either player can use the <Bold>"Propose Match Time"</Bold> button in the chat to propose a date, time, and court location.</Rule>
            <Rule>The other player can <Bold>accept</Bold> the proposed time or <Bold>decline and counter</Bold> with a new proposal. This back-and-forth continues until both players agree on a time.</Rule>
            <Rule>Once a proposal is accepted, the match is confirmed and both players will see the scheduled date, time, and location in the chat.</Rule>
            <Rule>Court fees, if any, are determined by mutual agreement between the players.</Rule>
            <Rule>If a match is not completed within the 14-day period, the challenge expires and no ladder movement or penalties will be assessed.</Rule>
          </ul>
        </Section>

        <Section title="Match Rules">
          <ul className="space-y-2">
            <Rule>Matches are played as an <Bold>8-Game Pro Set</Bold>.</Rule>
            <Rule>First player to win <Bold>8 games</Bold> wins the match (win by 2).</Rule>
            <Rule>If the score reaches <Bold>8-8</Bold>, a <Bold>tiebreak</Bold> is played to determine the winner (9-8).</Rule>
            <Rule>Warm-up time is determined by mutual agreement between the players.</Rule>
            <Rule>The challenger is responsible for providing a <Bold>new can of tennis balls</Bold>, unless both players agree otherwise.</Rule>
            <Rule>Players may play on any mutually agreed-upon court.</Rule>
          </ul>
        </Section>

        <Section title="Weather & Match Interruptions">
          <p className="text-sm">If weather or other unforeseen circumstances interrupt a match, the players may mutually decide whether to <Bold>resume the match from the current score</Bold> or <Bold>replay the match in its entirety</Bold>.</p>
        </Section>

        <Section title="Injuries & Retirements">
          <ul className="space-y-2">
            <Rule>If a player is unable to continue due to injury or illness after a match has begun, the match shall be recorded as a <Bold>Retirement</Bold> through the score submission page.</Rule>
            <Rule>The retiring player is considered to have <Bold>lost</Bold> the match.</Rule>
          </ul>
        </Section>

        <Section title="Score Reporting">
          <ul className="space-y-2">
            <Rule>Either player may submit the match score.</Rule>
            <Rule>The opposing player has <Bold>48 hours</Bold> to confirm the submitted score.</Rule>
            <Rule>If no action is taken within 48 hours, the submitted score is <Bold>automatically confirmed</Bold>.</Rule>
          </ul>
          <p className="font-semibold mt-3 mb-1">Score Disputes</p>
          <ol className="space-y-1.5 ml-2">
            <li className="text-sm">1. Players should first attempt to resolve the issue through the BreakPoint Ladders messaging system.</li>
            <li className="text-sm">2. If an agreement cannot be reached, either player may contact the Ladder Administrator through the platform.</li>
            <li className="text-sm">3. The Ladder Administrator will review the dispute and issue a final decision.</li>
          </ol>
          <p className="text-sm mt-2 text-muted-foreground">All decisions made by the Ladder Administrator are final.</p>
        </Section>

        <Section title="Ladder Movement">
          <ul className="space-y-2">
            <Rule>If the <Bold>higher-ranked player wins</Bold>, no ladder positions change.</Rule>
            <Rule>If the <Bold>lower-ranked player wins</Bold>: the winning player moves into the higher-ranked player's position, the losing player moves down one position, and every player previously ranked between those two players also moves down one position.</Rule>
          </ul>
        </Section>

        <Section title="Freeze My Spot">
          <p className="text-sm mb-3">Players who need to take a temporary break may freeze their ladder position.</p>
          <p className="text-sm font-semibold mb-1">While frozen, a player:</p>
          <ul className="space-y-2">
            <Rule>Cannot send challenges.</Rule>
            <Rule>Cannot receive challenges.</Rule>
            <Rule>Their ladder position remains unchanged.</Rule>
            <Rule>Their seasonal subscription continues during the freeze.</Rule>
          </ul>
          <p className="text-sm mt-3">Players may unfreeze their account at any time and immediately resume participation from the same ladder position.</p>
        </Section>

        <Section title="Sportsmanship & Conduct">
          <p className="text-sm mb-2">All matches are governed by the <Bold>USTA Code</Bold>. Every player is expected to:</p>
          <ul className="space-y-2">
            <Rule>Treat opponents with courtesy and respect.</Rule>
            <Rule>Make honest line calls.</Rule>
            <Rule>Display good sportsmanship both on and off the court.</Rule>
            <Rule>Refrain from abusive language or unsportsmanlike conduct.</Rule>
            <Rule>Never intentionally cheat, manipulate match results, or deliberately lose matches.</Rule>
          </ul>
        </Section>

        <Section title="Administrator Authority">
          <p className="text-sm mb-2">The Ladder Administrator reserves the right to:</p>
          <ul className="space-y-2">
            <Rule>Interpret and enforce these rules.</Rule>
            <Rule>Resolve disputes.</Rule>
            <Rule>Review match history and player communications when necessary.</Rule>
            <Rule>Suspend or permanently remove players for repeated rule violations, harassment, cheating, unsportsmanlike conduct, or behavior detrimental to the BreakPoint Ladders community.</Rule>
          </ul>
          <p className="text-sm mt-3 text-muted-foreground">All decisions made by the Ladder Administrator are final.</p>
        </Section>

        <Section title="Player Responsibility">
          <p className="text-sm mb-2">Every player is responsible for:</p>
          <ul className="space-y-2">
            <Rule>Responding to challenges promptly.</Rule>
            <Rule>Scheduling matches in good faith.</Rule>
            <Rule>Reporting accurate match results.</Rule>
            <Rule>Respecting opponents and administrators.</Rule>
            <Rule>Following the USTA Code.</Rule>
            <Rule>Helping maintain a welcoming, competitive, and enjoyable tennis community.</Rule>
          </ul>
        </Section>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Our goal is to make it easy to find competitive matches, improve your game, and build lasting connections with other tennis players. Good luck this season!
      </p>
    </div>
  );
}