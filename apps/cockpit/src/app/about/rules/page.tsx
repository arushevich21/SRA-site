const TOC = [
  { id: 'mission', label: '1. Mission Statement' },
  { id: 'conduct', label: '2. Code of Conduct' },
  { id: 'general', label: '3. General Rules' },
  { id: 'qualifying', label: '4. Qualifying Rules' },
  { id: 'racing', label: '5. Racing Rules' },
  { id: 'penalties', label: '6. Penalties' },
  { id: 'changelog', label: 'Appendix A: Changelog' },
];

export default function RulesPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-4">
        Rules &amp; Regulations
      </h1>
      <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-16">
        Last updated: January 10, 2026
      </p>

      <div className="flex gap-10">
        {/* Table of Contents — sticky sidebar */}
        <nav className="hidden lg:block w-[220px] shrink-0">
          <div className="sticky top-[100px]">
            <p className="font-mono text-[15px] tracking-[.35em] uppercase text-txt-3 mb-4">
              Contents
            </p>
            <ul className="space-y-2 border-l border-line pl-4">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="font-mono text-[15px] tracking-[.1em] text-txt-3 hover:text-gold transition-colors leading-tight block py-0.5"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Rules content */}
        <div className="min-w-0 flex-1">

      <h2 id="mission" className="font-display font-bold text-[28px] uppercase text-txt mb-6 scroll-mt-[100px]">
        1. Sim Racing Alliance Mission Statement
      </h2>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        The goal of the community and the purpose of this document is to
        establish a friendly environment where everyone can experience the best
        online sim racing has to offer. We are a community built on
        collaboration and encouraging community where everyone can improve and
        enjoy this shared hobby together.
      </p>

      <div className="h-px bg-line my-12" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Community Code of Conduct */}
      {/* ------------------------------------------------------------------ */}
      <h2 id="conduct" className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6 scroll-mt-[100px]">
        2. Community Code of Conduct
      </h2>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        The Sim Racing Alliance is an inclusive community. Discussion of
        politics, religion, and/or other controversial topics is prohibited.
        Incidents of racism, discrimination, or hate speech will not be
        tolerated and will result in an immediate ban.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Members are expected to demonstrate respect, courtesy, and humble
        behavior toward others. The league encourages openness to differing
        perspectives while condemning disrespectful behaviour such as
        harassment, -isms, hateful content, insults and name-calling.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        The organization enforces a zero-tolerance policy for toxicity,
        including excessive trolling, persistent negativity, personal attacks,
        flaming, harassment, behaviours intended to provoke or offend others.
        These violations can result in removal from the community.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Members should use proper channels for concerns: race incidents should
        be reported through the ticket system rather than public
        confrontations.
      </p>

      <div className="h-px bg-line my-12" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: General Rules */}
      {/* ------------------------------------------------------------------ */}
      <h2 id="general" className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6 scroll-mt-[100px]">
        3. General Rules
      </h2>

      {/* 3.1 Custom Liveries */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.1 Custom Liveries
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Custom liveries created outside of the in-game editor are permitted.
        Drivers must upload livery files with unique names to the Awesome
        Simracing tool. Additional instructions are available in the Graphics
        &amp; Liveries Discord channel.
      </p>

      {/* 3.2 Assists and Cheating */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.2 Assists and Cheating
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Included assists except auto-steering and stability control are allowed
        to be used on the practice and race servers. The league reserves
        authority to request telemetry data from any driver suspected of using
        third-party performance software. Failure to provide requested data or
        a guilty verdict may result in season or league bans.
      </p>

      {/* 3.3 Scoring */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.3 Scoring
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        The league awards championship points based on finishing position, with
        bonus points awarded for pole position and fastest lap during races.
        Points details appear in the championship tracker&apos;s points
        reference tab.
      </p>

      {/* 3.4 Driver Divisions and Classes */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.4 Driver Divisions and Classes
      </h3>

      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.4.1 Driver Classes
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        In GT3 Team Series competition, drivers are divided into divisions with
        50 maximum participants. Each division contains two splits: Gold and
        Silver. Classification is determined by race data and hot stint server
        performance. New drivers receive provisional assignments based on
        qualifying results. The organization reserves rights to adjust
        classifications for competitive integrity, typically after race two.
        Split adjustments occur after race three, then remain locked.
      </p>

      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.4.2 Driver Names
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Driver&apos;s name in ACC and Discord MUST match. The use of
        one&apos;s real name is NOT required. Names should be readable and
        pronounceable, with numbers and symbols discouraged. Registration
        occurs at simracingalliance.com/profile.
      </p>

      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.4.3 Driver Numbers
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Driver number 1 is reserved for the previous season&apos;s Division 1
        champion. Numbers 2&ndash;999 are available through
        simracingalliance.com/profile on a first-come basis. Numbers are
        retained under specific conditions:
      </p>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Two months as new members
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Two months post-participation in official championships
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Indefinitely for current champions and sponsors
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Through administrator discretion
        </li>
      </ul>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Numbers are locked during active championship schedules.
      </p>

      {/* 3.5 Practice */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.5 Practice
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Free practice sessions are available throughout the week with the same
        weather conditions as qualifying and the race. Drivers are encouraged
        to practice and adjust setups. Social interaction is permitted. While
        practice sessions lack stewarding, courtesy toward other drivers is
        expected.
      </p>

      {/* 3.6 Drivers Briefings */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.6 Drivers Briefings
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Race nights begin with mandatory drivers briefings in the designated
        Discord channel before official servers launch. Attendance is mandatory
        for all drivers participating in the race. Briefings cover race
        details, rule addendums, announcements, and server passwords. Drivers
        unable to attend should inform teammates of important information.
        Direct messaging administrators post-briefing is prohibited. All
        drivers are presumed knowledgeable of enforced rules on race day.
      </p>

      {/* 3.7 Race Delays Due To Server Issues */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.7 Race Delays Due To Server Issues
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Should there be a problem with ACC servers, the organizers will provide
        LAN join instructions for official Sim Racing Alliance events. If
        problems persist beyond 30 minutes, staff may delay the event to a
        later time. The organization may modify these rules based on attendance
        considerations.
      </p>

      {/* 3.8 No Chat During Qualifying and Racing */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        3.8 No Chat During Qualifying and Racing
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Use of the in-game chat at any time in official race servers is
        strictly prohibited. Chat is reserved for administrators or staff
        communicating critical information. Drivers should remember others may
        still be racing when they finish. Violations may result in penalty
        warnings. Questions should be raised in appropriate Discord channels.
      </p>

      <div className="h-px bg-line my-12" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Qualifying Rules */}
      {/* ------------------------------------------------------------------ */}
      <h2 id="qualifying" className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6 scroll-mt-[100px]">
        4. Qualifying Rules
      </h2>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Qualifying is held prior to race start and sets the starting order for
        the race based on each drivers&apos; fastest lap time.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Qualifying will typically be split into two halves where the lower
        class drivers will set their times first, followed by the upper class
        drivers. For split-qualifying, drivers may finish their valid hot lap
        if the lap was initiated before their allotted time runs out. All other
        drivers who cross the finish line after their allotted time must pull
        over and return to the pits.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        If a driver has been issued a qualifying ban, the driver is prohibited
        from participating in the qualifying session and must stay in their pit
        box. Failure to properly serve a qualifying ban may result in a
        disqualification in the qualifying session resulting in a pit lane
        start for that race, or the qualifying ban will carry over to the next
        race at the stewards/series managers&apos; discretion.
      </p>

      {/* 4.1 Blue Flags During Qualifying */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        4.1 Blue Flags During Qualifying
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        After invalidating a lap, a driver is then required to yield and leave
        sufficient space on track such that they do not hinder any driver
        behind on a flying lap. Drivers are required to make a clear and
        obvious effort to slow their car off of the racing line so as to not
        hinder oncoming drivers on flying laps, and only return to the racing
        line given a sufficient gap to the next driver behind.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Making a concerted effort to slow on a flying lap is construed as
        abandoning that flying lap, even if the lap is still valid. That
        driver is then required to yield and leave sufficient space on track
        such that they do not hinder any driver behind on a flying lap.
        Drivers are required to make a clear and obvious effort to slow their
        car off of the racing line so as to not hinder oncoming drivers on
        flying laps, and only return to the racing line given a sufficient gap
        to the next driver behind.
      </p>

      {/* 4.2 Overtaking During Qualifying */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        4.2 Overtaking During Qualifying
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        A driver is not allowed to overtake cars ahead that are on a flying
        valid lap unless it is clear and obvious that the car ahead has
        abandoned their lap and is leaving sufficient space to pass. Every
        driver is responsible to make sure there is a sufficient gap ahead at
        the start of a lap such that they will not overtake a car ahead on a
        flying lap.
      </p>

      {/* 4.3 Yellow Flags During Qualifying */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        4.3 Yellow Flags During Qualifying
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Drivers on flying laps do not need to slow down or yield for yellow
        flags, but have the responsibility of avoiding collisions should there
        be an incident ahead. Do not report incidents where a lap was
        compromised due to avoiding a driver who has spun out and is stationary
        on track.
      </p>

      {/* 4.4 Pit Exit Line During Qualifying */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        4.4 Pit Exit Line During Qualifying
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        During qualifying, drivers on a flying lap have the priority over cars
        exiting the pits. Take care not to impede those on a flying lap when
        exiting the pit lane. Note that the priority is reversed for the race
        in which cars exiting the pits and cars on track are both required to
        leave space for each other and all other racing rules apply.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Not observing these rules may result in qualifying warnings leading to
        a qualifying ban in a driver&apos;s next race.
      </p>

      <div className="h-px bg-line my-12" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Racing Rules */}
      {/* ------------------------------------------------------------------ */}
      <h2 id="racing" className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6 scroll-mt-[100px]">
        5. Racing Rules
      </h2>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        While we want to maintain fair and clean racing, accidents will happen.
        We will not tolerate abusing a driver that makes a mistake. Unless
        otherwise specified, we have a stewarding process to handle all
        on-track incidents through private tickets. Communication about tickets
        in public channels or direct messages to drivers, staff, and/or
        stewards will not be tolerated. Concerns may be brought to the
        attention of the administrators using the Admin-Help ticket tool.
        Harassment of others may result in a league ban.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        While not mandatory, Sim Racing Alliance strongly suggests keeping the
        radar and a partial circuit map enabled while racing to prevent
        incidents.
      </p>

      {/* 5.1 Overlap */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.1 Overlap
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Overlap is defined by the front axle of the attacking car being
        alongside the rear axle of the defending car at the turn-in point of
        the defending car. This is not an exact science, so there is some
        leeway for drivers and Stewards to judge overlap; particularly on lap 1
        where drivers are expected to be predictable with their positioning
        through corners while the grid is side by side.
      </p>

      {/* 5.2 Overtaking */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.2 Overtaking
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        In general, it is the responsibility of the car behind to choose a
        safe point to attempt an overtake, and to do so without causing an
        incident. Once the car behind establishes overlap, it becomes the
        responsibility of both drivers to avoid an incident.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        While cornering, the driver behind must have established overlap to the
        car in front at the lead driver&apos;s turn-in point for the corner
        before they should attempt an overtake. If there is no overlap at this
        point, the leading driver has the right to their racing line and does
        not need to leave space for the attacking driver.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Any collision during an attempted overtake may be subject to a penalty.
        If a rear-end collision is predicted in a braking zone, it is
        recommended to aim for the outside of the corner to avoid contact. Note
        that the turn-in point is not the start of the braking zone; drivers
        can still out brake each other to establish overlap before turn-in.
      </p>

      {/* 5.3 Overtaking and Violating Track Limits */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.3 Overtaking and Violating Track Limits
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        If an unfair advantage is gained from an off-track event, and an unfair
        advantage is gained from going off-track during an overtake (either as
        an attacker or defender), the position should be yielded to the other
        car, except if the off-track was made to avoid an incident. Stewards
        reserve the right to penalize keeping an unfair advantage from track
        limit violations.
      </p>

      {/* 5.4 Defending on the Straights and Squeezing */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.4 Defending on the Straights and Squeezing
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        The leading/defending car can choose any line they want to drive as
        long as they are fully clear of the car behind. However, they may only
        make one change of direction to defend their position, and the
        defensive positioning must be done before the trailing/attacking
        car&apos;s pass attempt. Any reactionary defensive move that attempts
        to cut off the trajectory/momentum of the attacking car after they pull
        out is considered blocking/squeezing and subject to penalties at the
        steward&apos;s discretion.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        After the leading/defending car has made their one defensive move off
        the racing line, they are allowed to move back towards the racing line
        before the braking zone if there is no overlap or the move back is done
        early enough for the trailing/attacking car to adjust their braking
        point. If the trailing/attacking car has gained overlap, the
        leading/defending must hold their line and give space to the attacking
        car.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        On a straight, any amount of overlap entitles a car to side-by-side
        space (unlike corners where axle to axle overlap must be achieved
        before the turn in of the lead/defending car). After overlap has been
        achieved on a straight, both the attacking and defending cars are
        entitled to their current line and are not required to move away from
        their current line as they approach the next corner. A driver
        attempting to guide or squeeze a car across the track while overlap is
        established will be found at fault for any resulting contact.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Weaving, or continuously altering your driving line on a straight in
        an attempt to break the slipstream or deny overlap to a car behind, is
        not allowed and may be penalized at the steward&apos;s discretion.
      </p>

      {/* 5.5 Incidents During the Race / Failure to Hold Brakes / Unsafe Rejoins */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.5 Incidents During the Race / Failure to Hold Brakes / Unsafe
        Rejoins
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        If a driver has totally lost control of their car in an incident, they
        are required to hold their brakes until control is regained and there
        is a sufficient gap to rejoin the racing line. The goal is to be as
        predictable as possible so other drivers do not cause additional
        incidents.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        If a driver is off-track, they must return to the track in a safe and
        predictable manner, and yield to cars that are on the racing line. More
        often than not, this means rejoining parallel to the track, off of the
        racing line. Unsafe rejoins and/or failure to hold brakes may result in
        a penalty at the discretion of the stewards.
      </p>

      {/* 5.6 Avoiding Incidents */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.6 Avoiding Incidents
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Stewards will review incidents and assess whether or not more cars were
        indirectly involved. Actions such as forcing 3-wide, risky defending,
        and risky overtaking in the immediate vicinity of other cars can lead
        to such incidents. If cars that were indirectly involved are found to
        be at fault, they may be penalized by the stewards.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        After crossing the checkered flag, intentionally making contact with
        another car is prohibited and doing so may result in a penalty based on
        the severity. This safety rule is due to the possibility of a
        wheelbase causing real physical harm to a person who is not
        anticipating contact.
      </p>

      {/* 5.7 Yellow Flags */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.7 Yellow Flags
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Under yellow flags, drivers are advised to drive cautiously and
        approach the incident prepared to reduce speed and take evasive action,
        if necessary. Stewards will penalize incidents caused under yellow
        flags more severely.
      </p>

      {/* 5.8 Black and Orange (Meatball) Flags */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.8 Black and Orange (Meatball) Flags
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        In most cases, drivers are shown the black and orange flag when they
        need to pit for repairs or turn on their headlights. If repairs are
        needed, drivers may attempt to drive back to the pits. If they do so,
        drivers are recommended to activate their flashers (left and right turn
        signals) and do their best to stay off the racing line to allow faster
        traffic to overtake safely.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        If drivers find they can not drive back to the pits, they can stop
        their car off track and teleport to the pits. This will result in ACC
        holding them in their pit stall for approximately 2&ndash;4 minutes.
        There is no additional penalty for teleporting to the pits. Note that
        the game will automatically disqualify any cars that finish a race
        under the black and orange flag.
      </p>

      {/* 5.9 Blue Flags */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.9 Blue Flags
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        In a race, a blue flag being shown means a car is about to lap a
        driver. When under blue flags, a driver is not allowed to defend from
        the lapping car when the lapping car makes an overtaking attempt. This
        does not mean the blue-flagged driver has to immediately slow down to
        let the lapping car through. Instead, it is up to the car behind to
        make a safe overtake, and for the lapped car to make sure they do not
        defend going into the next corner. Blue-flagged drivers should drive
        predictably and hold their line to avoid an incident with the lapping
        car.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        With that being said, it is still advised that blue-flagged drivers
        make it easy for lapping cars to pass them as this most often leads to
        the least amount of time lost for both cars. The best way to accomplish
        this is to lift while off of the racing line in the middle of the
        straight.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Drivers must yield the position to the lapping car within one full lap
        starting at the first marshal post to wave blue flags, regardless of
        pit strategy.
      </p>

      {/* 5.10 Unlapping */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.10 Unlapping
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Drivers are allowed to unlap themselves from cars that are laps ahead.
        Please only do so if you are confident that you are significantly
        faster than the car ahead and can pull away from them. After you have
        unlapped yourself, remember you are still not allowed to defend as long
        as there are blue flags.
      </p>

      {/* 5.11 Pit Lane Etiquette */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.11 Pit Lane Etiquette
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Once cleared of the white line, drivers are free to race. Dotted white
        lines may be crossed freely. Incidents resulting from pit line
        infringements will be punished more severely.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        During qualifying sessions, drivers exiting the pits must not interfere
        with drivers currently running hot laps. During a race session, drivers
        leaving the pits have priority, therefore, must be left space by
        drivers on track.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Drivers are expected to adhere to pit lane limits at all times.
        Stewards may enforce pit entry/exit requirements during the race
        defined by failure to keep 4 wheels within the white lines on pit
        entry/exit.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Drivers are not required to signal entering the pits (although it can
        be helpful at some circuits).
      </p>

      {/* 5.12 Unsportsmanlike Conduct */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        5.12 Unsportsmanlike Conduct
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Drivers are expected to race with intent to uphold the league mission
        statement and generally understood principles of sportsmanship.
        Intentionally ruining your own race with intent to influence the result
        against the favor of another driver(s) is subject to stewarding or
        additional disciplinary action from the admin team.
      </p>

      <div className="h-px bg-line my-12" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 6: Penalties */}
      {/* ------------------------------------------------------------------ */}
      <h2 id="penalties" className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6 scroll-mt-[100px]">
        6. Penalties
      </h2>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Penalties are announced in the weekly incident report and remain
        subject to appeals for 24 hours after the report is published.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Sim Racing Alliance officials will not tolerate on-track retaliation of
        any kind. Any on-track retaliation will result in a race
        disqualification or a one-race ban. Depending on the severity, it may
        be escalated up to an immediate ban from the league.
      </p>

      {/* 6.1 Qualifying Penalties */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.1 Qualifying Penalties
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Qualifying penalties are noted separately from race penalties. Stewards
        may apply qualifying warnings which include, but are not limited to
        completing a lap outside the assigned qualifying window, pit exit
        infractions, hindering/impeding, overtaking, and causing a collision.
        Two qualifying warnings in one season will result in a qualifying ban
        for the following race, but no penalty points are applied. For severe
        infractions during qualifying, stewards can assess a direct qualifying
        ban for the following race.
      </p>

      {/* 6.2 Race Penalties */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.2 Race Penalties
      </h3>

      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.2.1 Penalty Tiers
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        <strong className="text-txt">No Further Action (NFA):</strong> When
        the stewarding team believes there to be no incident, or no need to
        apply a penalty onto a single driver (i.e.: a racing incident).
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        <strong className="text-txt">Warning:</strong> The smallest penalty
        denomination that stewards may issue. Warnings may be issued to call
        attention to aggressive or unsafe driving behaviours such as excessive
        bump and runs, excessive weaving, moving under braking, etc. One
        penalty point will be issued for every two warnings awarded within the
        span of two races.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        <strong className="text-txt">Penalty Points (PP):</strong> For mild to
        severe infringement of the sporting regulations, the stewards will
        issue penalty point(s) against the infringing driver&apos;s License.
        Penalty point(s) will remain on the license for 8 races.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        <strong className="text-txt">Time Penalties:</strong> For mild to
        severe infringement of the sporting regulations, the stewards will
        issue time penalties that will be added to the total race time of the
        offending driver in the respective race.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        <strong className="text-txt">Post-Race Penalties:</strong> For severe
        infractions, the stewards will issue additional penalties that must be
        served in future races after the infraction occurred.
      </p>

      {/* Penalty Tier Summary */}
      <p className="font-sans text-sm text-txt font-semibold mt-6 mb-3">
        Penalty Tier Summary:
      </p>
      <div className="bg-panel border border-line rounded-lg p-6 mb-6">
        <ol className="list-decimal list-inside space-y-2 font-sans text-sm text-txt-2 leading-relaxed">
          <li>NFA</li>
          <li>Warning</li>
          <li>Warning + 5s</li>
          <li>10s + 1pp + Warning</li>
          <li>20s + 2pp + Warning</li>
          <li>
            30s + 2pp + Warning, qualifying ban next race (lap 1 upgrade only)
          </li>
        </ol>
        <p className="font-sans text-sm text-txt-3 mt-4 mb-2">
          Downgrade tiers (when position is returned):
        </p>
        <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed">
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            0s + 1pp (downgrade)
          </li>
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            0s + 2pp (downgrade)
          </li>
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            10s + 2pp (downgrade)
          </li>
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            20s + 2pp (downgrade)
          </li>
        </ul>
      </div>

      {/* 6.2.2 Penalty Point Structure */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.2.2 Penalty Point Structure
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Multiple penalty point infractions acquired in the same race or
        consecutive races will result in an additional penalty point being
        applied. This behaves similar to the &quot;warning&quot; system, where
        two infractions result in a full penalty point. For example, if two
        penalties for 1pp each are earned in consecutive races, a third penalty
        point will be automatically applied. See section 6.2.1 for further
        information regarding warnings.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Penalty points will be calculated on an 8 race rolling basis, including
        between seasons. Penalties for each tier of penalty point accrual will
        only be administered once per season (i.e.: one qualifying ban (4pp),
        one pit lane start (6pp), one race ban (8pp)). However, the penalty
        points are not cleared after serving a penalty. Additionally, the
        penalty must be served in attendance of an official race, meaning
        failure to attend does not count as serving a penalty. See below for
        further details.
      </p>

      {/* Post-race penalty summary */}
      <p className="font-sans text-sm text-txt font-semibold mt-6 mb-3">
        Post-race penalty summary:
      </p>
      <div className="bg-panel border border-line rounded-lg p-6 mb-6">
        <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed">
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            <span>
              <strong className="text-txt">4pp:</strong> Qualifying ban
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            <span>
              <strong className="text-txt">6pp:</strong> Pit lane start
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            <span>
              <strong className="text-txt">8pp:</strong> Race ban
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-gold shrink-0">—</span>
            <span>
              <strong className="text-txt">10pp:</strong> Season ban
            </span>
          </li>
        </ul>
      </div>

      {/* 6.2.3 Serving Penalties */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.2.3 Serving Penalties
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Time penalties will be retroactively applied to the respective race
        results by the organizers. Stop-go-30&apos;s are the exception and
        must be served during the following race.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Qualifying bans and pit lane starts will be enforced by the organizers
        at the start of the driver&apos;s following qualifying session.
        Enforcement will be issued in the form of in-game disqualification
        during the qualifying session.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        All penalties that affect future races will remain active for TWO
        races, meaning the driver will have to serve the penalty even if they
        voluntarily skip one race. If a driver skips two races, the penalty
        will be cleared. Penalties will not roll over to the following season.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Note that all stacking penalties must be served. If two qualifying bans
        are earned, they must be served across two races. The attendance rule
        above still applies, however.
      </p>

      {/* 6.2.4 Returning Position */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.2.4 Returning Position
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        If a driver waits to return the position after causing an incident, the
        time penalty will be downgraded while still retaining any penalty
        point(s) if given. For incidents at a penalty tier that include penalty
        point(s), the additional warning will also be removed.
      </p>

      {/* 6.2.5 Lap One Incidents */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.2.5 Lap One Incidents
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        All lap one incidents will be automatically reviewed by the stewards
        and will be classified as L1AUTO in the penalty report. It is still
        encouraged to submit tickets for lap 1 incidents to provide further
        context for the stewards to consider.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        All lap one incidents will have the penalty escalated by one tier
        because lap 1 incidents often detrimentally affect the race outcome.
        For severe cases, an additional penalty may be administered in the form
        of a 30s time penalty applied to the offending driver&apos;s next
        race.
      </p>

      {/* 6.2.6 Returning from a Season Ban */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.2.6 Returning from a Season Ban
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        If a driver accumulates 10 penalty points over an 8-race span, they
        will be assessed a season ban. If this occurs during the first 4 races
        of the season, at the discretion of the admin team, the driver will be
        banned for at least 2 races and will not be able to race again until
        their penalty point total is below 10. Once both of these criteria are
        met, they may then be allowed to race under our probationary policy for
        the remainder of the season. Drivers returning from a season ban from
        the prior season will be allowed to return for the next season but must
        begin the season under probation.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        <strong className="text-txt">Probation policy:</strong> Previously
        banned drivers must not accumulate 3 penalty points in the first 4
        races they participate in. If 3 penalty points are earned in the
        4-race probationary period, the driver will receive another season ban
        and will not be allowed to race until the following season.
      </p>

      {/* 6.3 Reporting Incidents */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.3 Reporting Incidents
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Sim Racing Alliance stewards use the ticketing tool in Discord. A
        driver must create a new ticket for each incident that they wish to
        report using the Submit-a-Ticket ticket tool in Discord. Drivers MUST
        review their own incidents via replays before submitting a ticket. The
        ticket must include the information requested in the prompt provided by
        the ticket tool. This includes screenshots or videos for each
        incident.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        While not required, if a driver causes an incident, the league
        strongly recommends our community members to reach out to the involved
        driver(s) via direct messages to apologize.
      </p>

      {/* 6.4 Post-Race Stewarding */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.4 Post-Race Stewarding
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        A driver must submit incident reports within 24 hours after the
        respective race ends. Tickets are to be strictly limited to submission
        by the cars involved, or by teammates of the cars involved in an
        incident. Reporting a third-party incident is strictly forbidden.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Stewards will go over all tickets and post a penalty report in the
        penalties channel of the Discord. If a steward or a steward&apos;s
        teammate was involved in an incident, they will not be involved in the
        ruling for that particular incident.
      </p>

      {/* 6.5 Report Format */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.5 Report Format
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Ticket submissions are required to provide the information requested in
        the prompt provided by the ticket tool. If a ticket does not follow the
        format or fails to provide all information requested, the ticket may be
        deemed invalid and may not be reviewed by the stewards.
      </p>

      {/* 6.6 Appealing */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        6.6 Appealing
      </h3>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Drivers can appeal post-race stewarding decisions if they feel that the
        penalty issued in the penalty report was unfair. Only the penalized
        driver may submit an appeal.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        To submit a post-race appeal, the penalized driver must submit a new
        ticket within 24 hours after the stewards post the penalty report in
        the Penalties channel of the Discord. In the new ticket, it is required
        to reference the original ticket number for which the appeal is opened
        and include justification for a different ruling. Drivers are limited
        to 3 denied Appeals per season. Once a driver reaches 3 denied
        appeals, they lose the ability to have their appeals reviewed for the
        rest of the season.
      </p>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Stewards will have a fresh look at the incident and post an appeal
        report later in the week.
      </p>

      <div className="h-px bg-line my-12" />

      {/* ------------------------------------------------------------------ */}
      {/* Appendix A: Changelog */}
      {/* ------------------------------------------------------------------ */}
      <h2 id="changelog" className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6 scroll-mt-[100px]">
        Appendix A: Changelog
      </h2>

      {/* Season 17 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 17 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Updated Section 6.1 to expand qualifying penalties
        </li>
      </ul>

      {/* Season 16 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 16 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Updated Section 6.2.6 to adjust season ban policy when ban occurs
          during the first half of season.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Adjusted probation policy to better align with the repeat offender
          clause.
        </li>
      </ul>

      {/* Season 15 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 15 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added verbiage to Section 5.1 regarding expectations for lap 1
          racecraft and behavior.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added verbiage to Section 5.4 regarding weaving on the straights.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added new Section 5.12 for unsportsmanlike conduct.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added a denied-appeal limit to Section 6.6.
        </li>
      </ul>

      {/* Season 13 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 13 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Updates to Section 5.6 - Avoiding Incidents, Section 6.2.1 - Penalty
          Tiers, &amp; Section 6.2.4 - Returning Position.
        </li>
      </ul>

      {/* Season 12 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 12 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Updated and clarified Section 5.4, defending and squeezing on
          straights.
        </li>
      </ul>

      {/* Season 11 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 11 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added details to Section 5.11 regarding consequences for removing pit
          boards.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Changed the harshest lap 1 penalty from 30s in the following race to
          a qualifying ban in the following race. See Section 6.2.1.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Tweaked penalty point application, adding an additional penalty point
          for any two infractions during the same or consecutive races. See
          Section 6.2.2.
        </li>
      </ul>

      {/* Season 7 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 7 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added details regarding driver number selection and availability.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added the admin right to request telemetry data if a driver is
          suspected of cheating.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Changed the 4-penalty-point tier from a pit lane start to a
          qualifying ban.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Implemented an absolute blue flag rule, active regardless of pit
          strategy differences.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          General condensing and clean-up.
        </li>
      </ul>

      {/* Season 6 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 6 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          No changes.
        </li>
      </ul>

      {/* Season 5 */}
      <h3 className="font-display font-bold text-[20px] uppercase text-txt-2 mt-10 mb-4">
        Season 5 Changes
      </h3>
      <ul className="space-y-2 font-sans text-sm text-txt-2 leading-relaxed mb-6">
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          For races with greater than 50 drivers, priority goes to drivers with
          teammates instead of fastest practice times.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Included LAN server clause if Kunos servers are down or causing
          delays.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added &quot;Drivers&apos; Briefing&quot; section.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Included clause for qualifying bans in the &quot;Qualifying
          Rules&quot; section.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Clarified all qualifying rules, no major changes.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Clarified all racing rules, no major changes.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Clarified grounds for qualifying warnings.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Removed penalties that award 3pp for a single incident, removed the
          SG30 penalty, created a warning +5s.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Replaced qualifying ban for 4 accrued penalty points with an
          additional pit lane start.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added &quot;Serving Penalties&quot; section for race-to-race
          rollover.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added &quot;Returning from a Season Ban&quot; section.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Added clause limiting drivers to submitting tickets on their own or
          their teammate&apos;s incidents in the &quot;Post-Race
          Stewarding&quot; section.
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0">—</span>
          Removed limit of 3 failed appeals.
        </li>
      </ul>

        </div>{/* end rules content */}
      </div>{/* end flex wrapper */}
    </section>
  );
}
