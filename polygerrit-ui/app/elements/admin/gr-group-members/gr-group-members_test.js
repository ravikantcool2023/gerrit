/**
 * @license
 * Copyright (C) 2017 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '../../../test/common-test-setup-karma.js';
import './gr-group-members.js';
import {dom, flush} from '@polymer/polymer/lib/legacy/polymer.dom.js';
import {stubBaseUrl} from '../../../test/test-utils.js';

const basicFixture = fixtureFromElement('gr-group-members');

suite('gr-group-members tests', () => {
  let element;

  let groups;
  let groupMembers;
  let includedGroups;
  let groupStub;

  setup(() => {
    groups = {
      name: 'Administrators',
      owner: 'Administrators',
      group_id: 1,
    };

    groupMembers = [
      {
        _account_id: 1000097,
        name: 'Jane Roe',
        email: 'jane.roe@example.com',
        username: 'jane',
      },
      {
        _account_id: 1000096,
        name: 'Test User',
        email: 'john.doe@example.com',
      },
      {
        _account_id: 1000095,
        name: 'Gerrit',
      },
      {
        _account_id: 1000098,
      },
    ];

    includedGroups = [{
      url: 'https://group/url',
      options: {},
      id: 'testId',
      name: 'testName',
    },
    {
      url: '/group/url',
      options: {},
      id: 'testId2',
      name: 'testName2',
    },
    {
      url: '#/group/url',
      options: {},
      id: 'testId3',
      name: 'testName3',
    },
    ];

    stub('gr-rest-api-interface', {
      getSuggestedAccounts(input) {
        if (input.startsWith('test')) {
          return Promise.resolve([
            {
              _account_id: 1000096,
              name: 'test-account',
              email: 'test.account@example.com',
              username: 'test123',
            },
            {
              _account_id: 1001439,
              name: 'test-admin',
              email: 'test.admin@example.com',
              username: 'test_admin',
            },
            {
              _account_id: 1001439,
              name: 'test-git',
              username: 'test_git',
            },
          ]);
        } else {
          return Promise.resolve({});
        }
      },
      getSuggestedGroups(input) {
        if (input.startsWith('test')) {
          return Promise.resolve({
            'test-admin': {
              id: '1ce023d3fb4e4260776fb92cd08b52bbd21ce70a',
            },
            'test/Administrator (admin)': {
              id: 'test%3Aadmin',
            },
          });
        } else {
          return Promise.resolve({});
        }
      },
      getLoggedIn() { return Promise.resolve(true); },
      getConfig() {
        return Promise.resolve();
      },
      getGroupMembers() {
        return Promise.resolve(groupMembers);
      },
      getIsGroupOwner() {
        return Promise.resolve(true);
      },
      getIncludedGroup() {
        return Promise.resolve(includedGroups);
      },
      getAccountCapabilities() {
        return Promise.resolve();
      },
    });
    element = basicFixture.instantiate();
    stubBaseUrl('https://test/site');
    element.groupId = 1;
    groupStub = sinon.stub(
        element.$.restAPI,
        'getGroupConfig')
        .callsFake(() => Promise.resolve(groups));
    return element._loadGroupDetails();
  });

  test('_includedGroups', () => {
    assert.equal(element._includedGroups.length, 3);
    assert.equal(dom(element.root)
        .querySelectorAll('.nameColumn a')[0].href, includedGroups[0].url);
    assert.equal(dom(element.root)
        .querySelectorAll('.nameColumn a')[1].href,
    'https://test/site/group/url');
    assert.equal(dom(element.root)
        .querySelectorAll('.nameColumn a')[2].href,
    'https://test/site/group/url');
  });

  test('save members correctly', () => {
    element._groupOwner = true;

    const memberName = 'test-admin';

    const saveStub = sinon.stub(element.$.restAPI, 'saveGroupMember')
        .callsFake(() => Promise.resolve({}));

    const button = element.$.saveGroupMember;

    assert.isTrue(button.hasAttribute('disabled'));

    element.$.groupMemberSearchInput.text = memberName;
    element.$.groupMemberSearchInput.value = 1234;

    assert.isFalse(button.hasAttribute('disabled'));

    return element._handleSavingGroupMember().then(() => {
      assert.isTrue(button.hasAttribute('disabled'));
      assert.isFalse(element.$.Title.classList.contains('edited'));
      assert.isTrue(saveStub.lastCall.calledWithExactly('Administrators',
          1234));
    });
  });

  test('save included groups correctly', () => {
    element._groupOwner = true;

    const includedGroupName = 'testName';

    const saveIncludedGroupStub = sinon.stub(
        element.$.restAPI, 'saveIncludedGroup')
        .callsFake(() => Promise.resolve({}));

    const button = element.$.saveIncludedGroups;

    assert.isTrue(button.hasAttribute('disabled'));

    element.$.includedGroupSearchInput.text = includedGroupName;
    element.$.includedGroupSearchInput.value = 'testId';

    assert.isFalse(button.hasAttribute('disabled'));

    return element._handleSavingIncludedGroups().then(() => {
      assert.isTrue(button.hasAttribute('disabled'));
      assert.isFalse(element.$.Title.classList.contains('edited'));
      assert.equal(saveIncludedGroupStub.lastCall.args[0], 'Administrators');
      assert.equal(saveIncludedGroupStub.lastCall.args[1], 'testId');
    });
  });

  test('add included group 404 shows helpful error text', () => {
    element._groupOwner = true;
    element._groupName = 'test';

    const memberName = 'bad-name';
    const alertStub = sinon.stub();
    element.addEventListener('show-alert', alertStub);
    const errorResponse = {
      status: 404,
      ok: false,
    };
    sinon.stub(element.$.restAPI._restApiHelper, 'fetch').callsFake(
        () => Promise.resolve(errorResponse));

    element.$.groupMemberSearchInput.text = memberName;
    element.$.groupMemberSearchInput.value = 1234;

    return flush(element._handleSavingIncludedGroups().then(() => {
      assert.isTrue(alertStub.called);
    }));
  });

  test('add included group network-error throws an exception', async () => {
    element._groupOwner = true;

    const memberName = 'bad-name';
    const alertStub = sinon.stub();
    element.addEventListener('show-alert', alertStub);
    const err = new Error();
    sinon.stub(element.$.restAPI._restApiHelper, 'fetch').callsFake(
        () => Promise.reject(err));

    element.$.groupMemberSearchInput.text = memberName;
    element.$.groupMemberSearchInput.value = 1234;

    let exceptionThrown = false;
    try {
      await element._handleSavingIncludedGroups();
    } catch (e) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);
  });

  test('_getAccountSuggestions empty', done => {
    element
        ._getAccountSuggestions('nonexistent').then(accounts => {
          assert.equal(accounts.length, 0);
          done();
        });
  });

  test('_getAccountSuggestions non-empty', done => {
    element
        ._getAccountSuggestions('test-').then(accounts => {
          assert.equal(accounts.length, 3);
          assert.equal(accounts[0].name,
              'test-account <test.account@example.com>');
          assert.equal(accounts[1].name, 'test-admin <test.admin@example.com>');
          assert.equal(accounts[2].name, 'test-git');
          done();
        });
  });

  test('_getGroupSuggestions empty', done => {
    element
        ._getGroupSuggestions('nonexistent').then(groups => {
          assert.equal(groups.length, 0);
          done();
        });
  });

  test('_getGroupSuggestions non-empty', done => {
    element
        ._getGroupSuggestions('test').then(groups => {
          assert.equal(groups.length, 2);
          assert.equal(groups[0].name, 'test-admin');
          assert.equal(groups[1].name, 'test/Administrator (admin)');
          done();
        });
  });

  test('_computeHideItemClass returns string for admin', () => {
    const admin = true;
    const owner = false;
    assert.equal(element._computeHideItemClass(owner, admin), '');
  });

  test('_computeHideItemClass returns hideItem for admin and owner', () => {
    const admin = false;
    const owner = false;
    assert.equal(element._computeHideItemClass(owner, admin), 'canModify');
  });

  test('_computeHideItemClass returns string for owner', () => {
    const admin = false;
    const owner = true;
    assert.equal(element._computeHideItemClass(owner, admin), '');
  });

  test('delete member', () => {
    const deleteBtns = dom(element.root)
        .querySelectorAll('.deleteMembersButton');
    MockInteractions.tap(deleteBtns[0]);
    assert.equal(element._itemId, '1000097');
    assert.equal(element._itemName, 'jane');
    MockInteractions.tap(deleteBtns[1]);
    assert.equal(element._itemId, '1000096');
    assert.equal(element._itemName, 'Test User');
    MockInteractions.tap(deleteBtns[2]);
    assert.equal(element._itemId, '1000095');
    assert.equal(element._itemName, 'Gerrit');
    MockInteractions.tap(deleteBtns[3]);
    assert.equal(element._itemId, '1000098');
    assert.equal(element._itemName, '1000098');
  });

  test('delete included groups', () => {
    const deleteBtns = dom(element.root)
        .querySelectorAll('.deleteIncludedGroupButton');
    MockInteractions.tap(deleteBtns[0]);
    assert.equal(element._itemId, 'testId');
    assert.equal(element._itemName, 'testName');
    MockInteractions.tap(deleteBtns[1]);
    assert.equal(element._itemId, 'testId2');
    assert.equal(element._itemName, 'testName2');
    MockInteractions.tap(deleteBtns[2]);
    assert.equal(element._itemId, 'testId3');
    assert.equal(element._itemName, 'testName3');
  });

  test('_computeLoadingClass', () => {
    assert.equal(element._computeLoadingClass(true), 'loading');

    assert.equal(element._computeLoadingClass(false), '');
  });

  test('_computeGroupUrl', () => {
    assert.isUndefined(element._computeGroupUrl(undefined));

    assert.isUndefined(element._computeGroupUrl(false));

    let url = '#/admin/groups/uuid-529b3c2605bb1029c8146f9de4a91c776fe64498';
    assert.equal(element._computeGroupUrl(url),
        'https://test/site/admin/groups/' +
        'uuid-529b3c2605bb1029c8146f9de4a91c776fe64498');

    url = 'https://gerrit.local/admin/groups/' +
        'uuid-529b3c2605bb1029c8146f9de4a91c776fe64498';
    assert.equal(element._computeGroupUrl(url), url);
  });

  test('fires page-error', done => {
    groupStub.restore();

    element.groupId = 1;

    const response = {status: 404};
    sinon.stub(
        element.$.restAPI, 'getGroupConfig')
        .callsFake((group, errFn) => {
          errFn(response);
        });
    element.addEventListener('page-error', e => {
      assert.deepEqual(e.detail.response, response);
      done();
    });

    element._loadGroupDetails();
  });
});

