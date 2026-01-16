/**
 * CLASSROOM GRADING APP - LOCAL LAN VERSION
 * * INSTRUCTIONS:
 * 1. Create a folder named 'public' in this directory.
 * 2. Save the frontend code as 'index.html' inside the 'public' folder.
 * 3. Run 'start.bat' to launch.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Security: MAC Address Lookup ---
function getMacAddress(ipAddress) {
    return new Promise((resolve) => {
        if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost') {
            return resolve('LOCALHOST');
        }

        // 1. Ping the IP first to ensure ARP table is populated
        // Windows: -n 1 (count), -w 200 (timeout ms)
        // Linux/Mac: -c 1 (count), -W 0.2 (timeout seconds)
        const pingCmd = process.platform === 'win32' 
            ? `ping -n 1 -w 200 ${ipAddress}`
            : `ping -c 1 -W 0.2 ${ipAddress}`;

        exec(pingCmd, (pingErr) => {
            // Ignore ping errors (firewalls might block ping, but ARP might still work if on same subnet)
            
            // 2. Look up ARP table
            const arpCmd = process.platform === 'win32' ? ('arp -a ' + ipAddress) : ('arp -n ' + ipAddress);
            exec(arpCmd, (error, stdout) => {
                if (error) return resolve(null);
                // Match MAC address (xx-xx-xx-xx-xx-xx or xx:xx:xx:xx:xx:xx)
                const macRegex = /([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/i;
                const match = stdout.match(macRegex);
                resolve(match ? match[0].toUpperCase() : null);
            });
        });
    });
}

// --- Network Interface Logic ---
function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const results = [];
    Object.keys(interfaces).forEach((ifname) => {
        interfaces[ifname].forEach((iface) => {
            // Skip internal and non-ipv4
            if ('IPv4' !== iface.family || iface.internal) return;
            results.push({
                name: ifname,
                address: iface.address,
                url: 'http://' + iface.address + ':' + PORT
            });
        });
    });
    // Fallback if no network found
    return results.length > 0 ? results : [{ name: 'Localhost Only', address: 'localhost', url: 'http://localhost:' + PORT }];
}

// --- In-Memory Database ---
let gameState = {
  sessionId: null,
  name: "Classroom Session",
  categories: [],
  currentSubject: "",
  currentParticipants: [], // New: List of participant names for the current subject
  votingMode: "group", // New: 'group', 'mixed', 'participants'
  isVotingOpen: false,
  votes: [], 
  availableIps: getNetworkInterfaces(), // Send all found IPs to frontend
  selectedIpIndex: 0 // Default to the first one found
};

// --- Connection Tracking (Map IP -> Socket ID) ---
const activeConnections = new Map();

// --- Routes ---

// Serve the main page explicitly (optional, since static does this, but good for safety)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// CSV Export Route
app.get('/export', (req, res) => {
  const categories = gameState.categories;
  const votes = gameState.votes;

  // Group by Main Subject first
  const votesByMainSubject = votes.reduce((acc, vote) => {
    if (!acc[vote.mainSubject]) acc[vote.mainSubject] = [];
    acc[vote.mainSubject].push(vote);
    return acc;
  }, {});

  // Prepare CSV Rows
  const csvRows = [];
  
  // Header Row
  const headers = ['Group/Subject', 'Participant/Detail', 'Vote Count', ...categories.map(c => c.name)];
  csvRows.push(headers.join(','));

  Object.entries(votesByMainSubject).forEach(([mainSubject, mainVotes]) => {
      // 1. Calculate Overall Group Average (All votes for this main subject)
      const groupCount = mainVotes.length;
      const groupCatTotals = {};
      
      mainVotes.forEach(vote => {
          categories.forEach(cat => {
              const score = parseFloat(vote.scores[cat.id] || 0);
              groupCatTotals[cat.id] = (groupCatTotals[cat.id] || 0) + score;
          });
      });

      const groupCatAvgs = categories.map(cat => (groupCatTotals[cat.id] / groupCount).toFixed(2));

      // Add Main Group Row
      csvRows.push([`"${mainSubject}"`, '"Group Score"', groupCount, ...groupCatAvgs].join(','));

      // 2. Break down by Sub-Subject (Participants)
      // Group the mainVotes by their specific 'subject' field
      const subVotesMap = mainVotes.reduce((acc, vote) => {
          if (!acc[vote.subject]) acc[vote.subject] = [];
          acc[vote.subject].push(vote);
          return acc;
      }, {});

      Object.entries(subVotesMap).forEach(([subSubject, subVotes]) => {
          // Skip if the subSubject is exactly the same as mainSubject (unless we want to list it as "Group Evaluation" specifically)
          // Based on user request, we want to see participants. 
          // If the mode was "Group Only", subSubject usually equals mainSubject.
          // If "Participants", subSubject is "Main - Participant".
          
          let displayName = subSubject;
          // Clean up display name
          if (subSubject.startsWith(mainSubject + " - ")) {
              displayName = subSubject.replace(mainSubject + " - ", "");
          } else if (subSubject === mainSubject || subSubject === `${mainSubject} (Group)`) {
             displayName = "Group Evaluation";
          }

          const count = subVotes.length;
          const catTotals = {};

          subVotes.forEach(vote => {
              categories.forEach(cat => {
                  const score = parseFloat(vote.scores[cat.id] || 0);
                  catTotals[cat.id] = (catTotals[cat.id] || 0) + score;
              });
          });

          const catAvgs = categories.map(cat => (catTotals[cat.id] / count).toFixed(2));

          // Add Sub Row (Indent Main Subject for clarity)
          csvRows.push([`""`, `"${displayName}"`, count, ...catAvgs].join(','));
      });
      
      // Add Spacer Row
      csvRows.push(',,,,');
  });

  res.header('Content-Type', 'text/csv');
  res.attachment('grading_results_' + new Date().toISOString().slice(0,10) + '.csv');
  res.send(csvRows.join('\n'));
});

// --- Socket Logic (Real-time Communication) ---
io.on('connection', async (socket) => {
  let clientIp = socket.handshake.address;
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substr(7);
  }

  // Identify User via MAC (or fallback to IP)
  const clientMac = await getMacAddress(clientIp);
  const clientId = clientMac || clientIp; 
  const idType = clientMac ? 'MAC' : 'IP';

  console.log('Connection: ' + clientIp + ' [' + idType + ': ' + clientId + '] (Socket: ' + socket.id + ')');

  // Limit One Connection Per Device
  if (activeConnections.has(clientId)) {
    const oldSocketId = activeConnections.get(clientId);
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (oldSocket && oldSocket.id !== socket.id) {
      oldSocket.emit('force-disconnect', 'New connection from this device detected.');
      oldSocket.disconnect(true);
    }
  }

  activeConnections.set(clientId, socket.id);
  
  // Refresh IPs on connection (in case network changed)
  gameState.availableIps = getNetworkInterfaces();
  socket.emit('state-update', gameState);

  socket.on('disconnect', () => {
    if (activeConnections.get(clientId) === socket.id) {
      activeConnections.delete(clientId);
    }
  });

  socket.on('host-create-session', (data) => {
    gameState.name = data.name;
    gameState.categories = data.categories;
    gameState.sessionId = Math.random().toString(36).substring(7);
    gameState.votes = []; 
    io.emit('state-update', gameState);
  });

  socket.on('host-select-ip', (index) => {
      if (index >= 0 && index < gameState.availableIps.length) {
          gameState.selectedIpIndex = index;
          io.emit('state-update', gameState);
      }
  });

  socket.on('host-update-status', (data) => {
    if (data.currentSubject !== undefined) gameState.currentSubject = data.currentSubject;
    if (data.isVotingOpen !== undefined) gameState.isVotingOpen = data.isVotingOpen;
    // New fields for Participants
    if (data.currentParticipants !== undefined) gameState.currentParticipants = data.currentParticipants;
    if (data.votingMode !== undefined) gameState.votingMode = data.votingMode;

    io.emit('state-update', gameState);
  });

  socket.on('student-submit-vote', (data) => {
    if (!gameState.isVotingOpen) return;
    
    // Prevent Double Voting (Check MAC/ClientID against the MAIN Subject)
    // We check if this user has submitted ANY vote for the current main subject.
    const alreadyVoted = gameState.votes.some(v => 
        v.mainSubject === gameState.currentSubject && v.clientId === clientId
    );

    if (alreadyVoted) {
        socket.emit('error-message', 'You have already voted for this subject!');
        return;
    }

    // Process the submission (which might contain multiple vote items)
    // data.items expected to be array of { type: 'group'|'participant', name: string, scores: object }
    const items = data.items || [];

    items.forEach(item => {
        let displaySubject = gameState.currentSubject;

        // Generate Display Subject Name based on type
        if (item.type === 'group') {
             // If mixed mode, clarify it's the group score. If group only, keep it clean.
             if (gameState.votingMode === 'mixed') {
                 displaySubject = `${gameState.currentSubject} (Group)`;
             } else {
                 displaySubject = gameState.currentSubject;
             }
        } else if (item.type === 'participant') {
             displaySubject = `${gameState.currentSubject} - ${item.name}`;
        }

        gameState.votes.push({
            mainSubject: gameState.currentSubject, // Used for duplicate checking
            subject: displaySubject,               // Used for CSV grouping
            scores: item.scores,
            voterId: socket.id,
            voterIp: clientIp,
            clientId: clientId
        });
    });

    io.emit('state-update', gameState);
  });
});

// --- Start Server ---
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log('CLASSROOM SERVER RUNNING!');
  console.log('TEACHER: Access http://localhost:' + PORT);
  console.log('\n--- AVAILABLE NETWORK ADDRESSES ---');
  
  const ips = getNetworkInterfaces();
  ips.forEach(ip => {
      console.log('[' + ip.name + ']: ' + ip.url);
  });
  console.log('==================================================\n');
});