const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// JSON data files
const subredditsFilePath = './data/subreddits.json';
const usersFilePath = './data/users.json';

// Initializing data or load from files
let subreddits = loadDataFromFile(subredditsFilePath);
let users = loadDataFromFile(usersFilePath);

// loading data from JSON file
function loadDataFromFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
}

// saving data to JSON file
function saveDataToFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
  }
}

// creating a new subreddit
function createSubreddit(name, description) {
  const newSubreddit = { id: uuidv4(), name, description, posts: [] };
  subreddits.push(newSubreddit);
  saveDataToFile(subredditsFilePath, subreddits); // Save to file
  return newSubreddit;
}

// finding a subreddit by ID
function findSubredditById(subredditId) {
  const subreddit = subreddits.find(sub => sub.id === subredditId);
  return subreddit ? { ...subreddit } : null;
}

// subscribing a user to a subreddit
function subscribeUser(userId, subredditId) {
  const user = users.find(user => user.id === userId);
  if (user) {
    if (!user.subscriptions.includes(subredditId)) {
      user.subscriptions.push(subredditId);
      saveDataToFile(usersFilePath, users); // Save to file
    }
  }
}

// creating a new user
function createUser(userId, subscriptions = []) {
  const newUser = { id: userId, subscriptions, upvotesReceived: [] }; // Added upvotesReceived
  users.push(newUser);
  saveDataToFile(usersFilePath, users); // Save to file
  return newUser;
}

// creating a new post in a subreddit
function createPost(subredditId, title, content, userId) {
  const subreddit = findSubredditById(subredditId);
  const user = users.find(user => user.id === userId);

  if (subreddit && user) {
    const newPost = {
      id: uuidv4(),
      title,
      content,
      author: userId,
      createdAt: new Date().toISOString(),
      upvotes: 0,
      comments: []
    };

    subreddit.posts.push(newPost);
    saveDataToFile(subredditsFilePath, subreddits); 

    // Updating user's posts array
    user.posts = user.posts || [];
    user.posts.push(newPost.id);
    saveDataToFile(usersFilePath, users);

    return newPost;
  }
  return null;
}

// finding a post by ID across all subreddits
function findPostById(postId) {
  for (let subreddit of subreddits) {
    const post = subreddit.posts.find(post => post.id === postId);
    if (post) {
      return post;
    }
  }
  return null;
}

// upvoting a post
function upvotePost(postId, userId) {
  for (let subreddit of subreddits) {
    const post = subreddit.posts.find(post => post.id === postId);
    if (post) {
      post.upvotes++;

      // upvoting received by post author
      const author = users.find(user => user.id === post.author);
      if (author) {
        author.upvotesReceived.push({
          postId,
          upvoterId: userId,
          createdAt: new Date().toISOString()
        });
        saveDataToFile(usersFilePath, users); 
      }

      saveDataToFile(subredditsFilePath, subreddits); 
      return post;
    }
  }
  return null;
}

// adding a comment to a post
function addComment(postId, text, author) {
  for (let subreddit of subreddits) {
    const post = subreddit.posts.find(post => post.id === postId);
    if (post) {
      const newComment = { id: uuidv4(), text, author, createdAt: Date.now() };
      post.comments.push(newComment);
      saveDataToFile(subredditsFilePath, subreddits); // Save to file
      return newComment;
    }
  }
  return null;
}

// retrieving user profile
function getUserProfile(userId) {
  const user = users.find(user => user.id === userId);
  if (user) {
    const userSubscriptions = user.subscriptions.map(subredditId => findSubredditById(subredditId));
    const userUpvotes = user.upvotesReceived.map(upvote => {
      const post = findPostById(upvote.postId);
      return {
        post,
        upvoterId: upvote.upvoterId,
        createdAt: upvote.createdAt
      };
    });
    return { user, subscriptions: userSubscriptions, upvotesReceived: userUpvotes };
  }
  return null;
}

// readline interface for terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
function promptInput(promptText) {
  return new Promise(resolve => {
    rl.question(promptText, answer => {
      resolve(answer.trim());
    });
  });
}

// Handling subreddit creation via terminal input
async function handleSubredditCreation() {
  const name = await promptInput('Enter subreddit name: ');
  const description = await promptInput('Enter subreddit description: ');
  const newSubreddit = createSubreddit(name, description);
  console.log(`Subreddit created: ${newSubreddit.name}`);
}

// Handling user subscription to subreddit via terminal input
async function handleUserSubscription() {
  const userId = await promptInput('Enter user ID: ');
  const subredditId = await promptInput('Enter subreddit ID to subscribe: ');
  subscribeUser(userId, subredditId);
  console.log(`User ${userId} subscribed to subreddit ${subredditId}`);
}

// Handling creating a new post via terminal input
async function handlePostCreation() {
  const subredditId = await promptInput('Enter subreddit ID to post in: ');
  const title = await promptInput('Enter post title: ');
  const content = await promptInput('Enter post content: ');
  const userId = await promptInput('Enter user ID: ');
  const newPost = createPost(subredditId, title, content, userId);
  if (newPost) {
    console.log(`New post created in subreddit ${subredditId}: ${newPost.title}`);
  } else {
    console.log(`Subreddit with ID ${subredditId} not found.`);
  }
}

// Handling adding a comment to a post via terminal input
async function handleCommentAddition() {
  const postId = await promptInput('Enter post ID to comment on: ');
  const text = await promptInput('Enter comment text: ');
  const author = await promptInput('Enter comment author: ');
  const newComment = addComment(postId, text, author);
  if (newComment) {
    console.log(`New comment added to post ${postId}: ${newComment.text}`);
  } else {
    console.log(`Post with ID ${postId} not found.`);
  }
}

// Handling upvoting a post via terminal input
async function handleUpvote() {
  const postId = await promptInput('Enter post ID to upvote: ');
  const userId = await promptInput('Enter user ID who is upvoting: ');
  const updatedPost = upvotePost(postId, userId);
  if (updatedPost) {
    console.log(`Post ${postId} upvoted. Current upvotes: ${updatedPost.upvotes}`);
  } else {
    console.log(`Post with ID ${postId} not found.`);
  }
}

// Handling creating a new user via terminal input
async function handleUserCreation() {
  const userId = await promptInput('Enter user ID: ');
  const newUser = createUser(userId);
  console.log(`User created: ${newUser.id}`);
}



// Creating a new subreddit
app.post('/subreddits', (req, res) => {
  const { name, description } = req.body;
  const newSubreddit = createSubreddit(name, description);
  res.status(201).json(newSubreddit);
});

// Retriving all subreddits
app.get('/subreddits', (req, res) => {
  res.json(subreddits);
});

const PriorityQueue = require('js-priority-queue');
const moment = require('moment-timezone');

// Retrieve posts of a specific subreddit, sorted by createdAt in descending order using a priority queue
app.get('/subreddits/:subredditId/posts', (req, res) => {
  const subredditId = req.params.subredditId;
  const subreddit = findSubredditById(subredditId);

  if (!subreddit) {
    return res.status(404).json({ error: 'Subreddit not found' });
  }

  // Use a priority queue to sort posts by createdAt in descending order
  const pq = new PriorityQueue({ comparator: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) });

  subreddit.posts.forEach(post => pq.queue(post));

  const sortedPosts = [];
  while (pq.length) {
    sortedPosts.push(pq.dequeue());
  }

  // Convert createdAt to EST for each post
  const postsWithEST = sortedPosts.map(post => ({
    ...post,
    createdAt: moment(post.createdAt).tz('America/New_York').format()
  }));

  res.json(postsWithEST);
});



// Retrieving a specific post by ID
app.get('/posts/:postId', (req, res) => {
  const { postId } = req.params;
  let foundPost = null;

  // Searching for the post in all subreddits
  for (let subreddit of subreddits) {
    const post = subreddit.posts.find(post => post.id === postId);
    if (post) {
      foundPost = post;
      break;
    }
  }

  if (!foundPost) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Formating createdAt to EST timezone
  const formattedCreatedAt = new Date(foundPost.createdAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour12: false // Use 24-hour format
  });

  // Creating a response object with formatted date
  const responsePost = {
    ...foundPost,
    createdAt: formattedCreatedAt
  };

  res.json(responsePost);
});

// Creating a new post in a subreddit
app.post('/subreddits/:subredditId/posts', (req, res) => {
  const subredditId = req.params.subredditId;
  const { title, content, author } = req.body;
  const newPost = createPost(subredditId, title, content, author);
  if (!newPost) {
    return res.status(404).json({ error: 'Subreddit not found' });
  }
  res.status(201).json(newPost);
});

// Upvoting a specific post
app.post('/posts/:postId/upvote', (req, res) => {
  const postId = req.params.postId;
  const userId = req.body.userId; // Assuming userId is sent in the request body
  const updatedPost = upvotePost(postId, userId);
  if (!updatedPost) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(updatedPost);
});

// Adding a comment to a post
app.post('/posts/:postId/comments', (req, res) => {
  const postId = req.params.postId;
  const { text, author } = req.body;
  const newComment = addComment(postId, text, author);
  if (!newComment) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.status(201).json(newComment);
});

// Subscribing a user to a subreddit
app.post('/users/:userId/subscriptions', (req, res) => {
  const { userId } = req.params;
  const { subredditId } = req.body;
  subscribeUser(userId, subredditId);
  res.status(200).json({ message: `Subscribed user ${userId} to subreddit ${subredditId}` });
});

// Retriving user profile
app.get('/users/:userId/profile', (req, res) => {
  const { userId } = req.params;
  
  // retriving user profile based on userId
  const userProfile = getUserProfile(userId);
  
 
  if (!userProfile) {
    
    return res.status(404).json({ error: 'User not found' });
  }
  
  
  res.json(userProfile);
});

// Creating a new user
app.post('/users', (req, res) => {
  const { userId, subscriptions } = req.body;
  const newUser = createUser(userId, subscriptions);
  res.status(201).json(newUser);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  // Starting handling terminal input
  rl.setPrompt('Enter command: ');
  rl.prompt();

  rl.on('line', async input => {
    switch (input.trim()) {
      case 'user creates subreddit':
        await handleSubredditCreation();
        break;
      case 'user subscribes to a post':
        await handleUserSubscription();
        break;
      case 'user creates a post':
        await handlePostCreation();
        break;
      case 'user adds comment':
        await handleCommentAddition();
        break;
      case 'user upvotes post':
        await handleUpvote();
        break;
      case 'create user':
        await handleUserCreation();
        break;
      case 'exit':
        rl.close();
        process.exit(0);
      default:
        console.log('Invalid command');
        break;
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('Terminal session closed');
    process.exit(0);
  });
});


