# LANVotePage

Run start.bat teacher will join as localhost and students will join with the local IP.
NodeJS must have firewall access.

ONLY WORKS ON LAN.

Features
- IP + MAC Check to confirm only one vote per machine. (Theres probably a way to bypass, but it defends from basic bypasses).
- CSV Export.
- Live voting updates.
- Multiple voting modes:
  > Group Only -> You only vote for the group grade.
  
  > Group + Participants -> You vote for the group grade and each participants grade.
  
  > Participans Only -> You only vote for each participants grade, group grade is the average of all grades.
- Network selection (In case you have multiple networks, for example VMs).
- Ability to choose criteria and max/min grades.
- Cool UI
