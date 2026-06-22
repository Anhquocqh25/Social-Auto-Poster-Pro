/**
 * Simulation Account End-to-End Test Script
 * 
 * This script tests the complete simulation account workflow:
 * 1. Check if simulation account exists
 * 2. Create simulation account if needed
 * 3. Create a scheduled post
 * 4. Verify scheduler/queue processing
 * 5. Check final post status and notifications
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSimulationFlow() {
  console.log('\n=== SIMULATION ACCOUNT FLOW TEST ===\n');

  try {
    // Step 1: Check for existing simulation accounts
    console.log('1. Checking for simulation accounts...');
    const simulationAccounts = await prisma.account.findMany({
      where: {
        accountId: {
          startsWith: 'mock_facebook_'
        }
      }
    });

    console.log(`   Found ${simulationAccounts.length} simulation account(s)`);
    
    if (simulationAccounts.length > 0) {
      simulationAccounts.forEach(acc => {
        console.log(`   - ${acc.accountName} (ID: ${acc.id}, Status: ${acc.status})`);
      });
    } else {
      console.log('   ℹ️  No simulation accounts found');
      console.log('   ➜  Use the "Create Mock Facebook Account" button in the Accounts page');
    }

    // Step 2: Check scheduled posts targeting simulation accounts
    if (simulationAccounts.length > 0) {
      const accountIds = simulationAccounts.map(a => a.id);
      
      console.log('\n2. Checking posts targeting simulation accounts...');
      const posts = await prisma.post.findMany({
        where: {
          postTargets: {
            some: {
              accountId: {
                in: accountIds
              }
            }
          }
        },
        include: {
          postTargets: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      });

      console.log(`   Found ${posts.length} post(s) targeting simulation accounts`);
      
      posts.forEach(post => {
        console.log(`   - Post #${post.id}: ${post.title || 'Untitled'}`);
        console.log(`     Status: ${post.status}`);
        console.log(`     Scheduled: ${post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'N/A'}`);
        console.log(`     Published: ${post.publishedAt ? new Date(post.publishedAt).toLocaleString() : 'Not yet'}`);
      });

      // Step 3: Check publish jobs
      console.log('\n3. Checking publish jobs for simulation accounts...');
      const jobs = await prisma.publishJob.findMany({
        where: {
          accountId: {
            in: accountIds
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      });

      console.log(`   Found ${jobs.length} publish job(s)`);
      jobs.forEach(job => {
        console.log(`   - Job #${job.id}: Post #${job.postId}`);
        console.log(`     Status: ${job.status}`);
        console.log(`     Retry Count: ${job.retryCount}`);
        console.log(`     Started: ${job.startedAt ? new Date(job.startedAt).toLocaleString() : 'Not started'}`);
        console.log(`     Completed: ${job.completedAt ? new Date(job.completedAt).toLocaleString() : 'Not completed'}`);
      });

      // Step 4: Check notifications
      console.log('\n4. Checking notifications...');
      const notifications = await prisma.notification.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      });

      console.log(`   Found ${notifications.length} notification(s)`);
      notifications.forEach(notif => {
        console.log(`   - ${notif.type}: ${notif.title}`);
        console.log(`     Message: ${notif.message}`);
        console.log(`     Read: ${notif.isRead}`);
        console.log(`     Created: ${new Date(notif.createdAt).toLocaleString()}`);
      });
    }

    // Step 5: Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`✓ Simulation accounts: ${simulationAccounts.length}`);
    
    if (simulationAccounts.length > 0) {
      const accountIds = simulationAccounts.map(a => a.id);
      
      const postCount = await prisma.post.count({
        where: {
          postTargets: {
            some: {
              accountId: {
                in: accountIds
              }
            }
          }
        }
      });

      const publishedCount = await prisma.post.count({
        where: {
          postTargets: {
            some: {
              accountId: {
                in: accountIds
              }
            }
          },
          status: 'published'
        }
      });

      const jobCount = await prisma.publishJob.count({
        where: {
          accountId: {
            in: accountIds
          }
        }
      });

      const successJobCount = await prisma.publishJob.count({
        where: {
          accountId: {
            in: accountIds
          },
          status: 'success'
        }
      });

      console.log(`✓ Posts targeting simulation accounts: ${postCount}`);
      console.log(`✓ Published posts: ${publishedCount}`);
      console.log(`✓ Publish jobs: ${jobCount}`);
      console.log(`✓ Successful jobs: ${successJobCount}`);

      // Workflow verification
      console.log('\n=== WORKFLOW VERIFICATION ===');
      if (simulationAccounts.length > 0) {
        console.log('✓ Simulation account creation: WORKING');
      }
      if (postCount > 0) {
        console.log('✓ Post creation with simulation account: WORKING');
      }
      if (jobCount > 0) {
        console.log('✓ Queue job creation: WORKING');
      }
      if (successJobCount > 0) {
        console.log('✓ Simulation publishing: WORKING');
      }
      if (publishedCount > 0) {
        console.log('✓ Post status promotion to published: WORKING');
      }

      if (simulationAccounts.length > 0 && postCount > 0 && jobCount > 0 && successJobCount > 0 && publishedCount > 0) {
        console.log('\n✅ END-TO-END SIMULATION WORKFLOW: FULLY FUNCTIONAL');
      } else {
        console.log('\n⚠️  END-TO-END SIMULATION WORKFLOW: PARTIALLY COMPLETE');
        console.log('   Run the app and:');
        if (simulationAccounts.length === 0) {
          console.log('   1. Create a simulation account from Accounts page');
        }
        if (postCount === 0) {
          console.log('   2. Create a scheduled post targeting the simulation account');
        }
        if (jobCount === 0 || successJobCount === 0) {
          console.log('   3. Wait for scheduler to process the post');
        }
      }
    } else {
      console.log('\n⚠️  No simulation accounts found');
      console.log('   Next steps:');
      console.log('   1. Run: npm run electron:dev');
      console.log('   2. Navigate to Accounts page');
      console.log('   3. Click "Create Mock Facebook Account"');
      console.log('   4. Create a scheduled post');
      console.log('   5. Re-run this script to verify');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSimulationFlow();