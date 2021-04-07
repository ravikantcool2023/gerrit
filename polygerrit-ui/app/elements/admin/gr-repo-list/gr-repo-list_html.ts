/**
 * @license
 * Copyright (C) 2020 The Android Open Source Project
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
import {html} from '@polymer/polymer/lib/utils/html-tag';

export const htmlTemplate = html`
  <style include="shared-styles">
    /* Workaround for empty style block - see https://github.com/Polymer/tools/issues/408 */
  </style>
  <style include="gr-table-styles">
    /* Workaround for empty style block - see https://github.com/Polymer/tools/issues/408 */
  </style>
  <style>
    .genericList tr td:last-of-type {
      text-align: left;
    }
    .genericList tr th:last-of-type {
      text-align: left;
    }
    .readOnly {
      text-align: center;
    }
    .changesLink,
    .name,
    .repositoryBrowser,
    .readOnly {
      white-space: nowrap;
    }
  </style>
  <gr-list-view
    create-new="[[_createNewCapability]]"
    filter="[[_filter]]"
    items-per-page="[[_reposPerPage]]"
    items="[[_repos]]"
    loading="[[_loading]]"
    offset="[[_offset]]"
    on-create-clicked="_handleCreateClicked"
    path="[[_path]]"
  >
    <table id="list" class="genericList">
      <tbody>
        <tr class="headerRow">
          <th class="name topHeader">Repository Name</th>
          <th class="repositoryBrowser topHeader">Repository Browser</th>
          <th class="changesLink topHeader">Changes</th>
          <th class="topHeader readOnly">Read only</th>
          <th class="description topHeader">Repository Description</th>
        </tr>
        <tr id="loading" class$="loadingMsg [[computeLoadingClass(_loading)]]">
          <td>Loading...</td>
        </tr>
      </tbody>
      <tbody class$="[[computeLoadingClass(_loading)]]">
        <template is="dom-repeat" items="[[_shownRepos]]">
          <tr class="table">
            <td class="name">
              <a href$="[[_computeRepoUrl(item.name)]]">[[item.name]]</a>
            </td>
            <td class="repositoryBrowser">
              <template
                is="dom-repeat"
                items="[[_computeWeblink(item)]]"
                as="link"
              >
                <a
                  href$="[[link.url]]"
                  class="webLink"
                  rel="noopener"
                  target="_blank"
                >
                  [[link.name]]
                </a>
              </template>
            </td>
            <td class="changesLink">
              <a href$="[[_computeChangesLink(item.name)]]">view all</a>
            </td>
            <td class="readOnly">[[_readOnly(item)]]</td>
            <td class="description">[[item.description]]</td>
          </tr>
        </template>
      </tbody>
    </table>
  </gr-list-view>
  <gr-overlay id="createOverlay" with-backdrop="">
    <gr-dialog
      id="createDialog"
      class="confirmDialog"
      disabled="[[!_hasNewRepoName]]"
      confirm-label="Create"
      on-confirm="_handleCreateRepo"
      on-cancel="_handleCloseCreate"
    >
      <div class="header" slot="header">Create Repository</div>
      <div class="main" slot="main">
        <gr-create-repo-dialog
          has-new-repo-name="{{_hasNewRepoName}}"
          id="createNewModal"
        ></gr-create-repo-dialog>
      </div>
    </gr-dialog>
  </gr-overlay>
`;
