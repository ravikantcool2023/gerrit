// Copyright (C) 2014 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.google.gerrit.client.editor;

import com.google.gerrit.client.Gerrit;
import com.google.gerrit.client.JumpKeys;
import com.google.gerrit.client.VoidResult;
import com.google.gerrit.client.account.DiffPreferences;
import com.google.gerrit.client.changes.ChangeApi;
import com.google.gerrit.client.changes.ChangeFileApi;
import com.google.gerrit.client.changes.ChangeInfo;
import com.google.gerrit.client.diff.FileInfo;
import com.google.gerrit.client.diff.Header;
import com.google.gerrit.client.rpc.CallbackGroup;
import com.google.gerrit.client.rpc.GerritCallback;
import com.google.gerrit.client.rpc.ScreenLoadCallback;
import com.google.gerrit.client.ui.Screen;
import com.google.gerrit.common.PageLinks;
import com.google.gerrit.reviewdb.client.Patch;
import com.google.gerrit.reviewdb.client.PatchSet;
import com.google.gwt.core.client.GWT;
import com.google.gwt.core.client.Scheduler;
import com.google.gwt.core.client.Scheduler.ScheduledCommand;
import com.google.gwt.dom.client.Element;
import com.google.gwt.event.dom.client.ClickEvent;
import com.google.gwt.event.dom.client.KeyPressEvent;
import com.google.gwt.event.logical.shared.ResizeEvent;
import com.google.gwt.event.logical.shared.ResizeHandler;
import com.google.gwt.event.shared.HandlerRegistration;
import com.google.gwt.uibinder.client.UiBinder;
import com.google.gwt.uibinder.client.UiField;
import com.google.gwt.uibinder.client.UiHandler;
import com.google.gwt.user.client.Window;
import com.google.gwt.user.client.Window.ClosingEvent;
import com.google.gwt.user.client.Window.ClosingHandler;
import com.google.gwt.user.client.rpc.AsyncCallback;
import com.google.gwt.user.client.ui.Button;
import com.google.gwt.user.client.ui.HTMLPanel;
import com.google.gwtexpui.globalkey.client.GlobalKey;
import com.google.gwtexpui.safehtml.client.SafeHtml;

import net.codemirror.lib.CodeMirror;
import net.codemirror.lib.CodeMirror.ChangesHandler;
import net.codemirror.lib.Configuration;
import net.codemirror.lib.KeyMap;
import net.codemirror.lib.Pos;
import net.codemirror.mode.ModeInfo;
import net.codemirror.mode.ModeInjector;
import net.codemirror.theme.ThemeLoader;

public class EditScreen extends Screen {
  interface Binder extends UiBinder<HTMLPanel, EditScreen> {}
  private static final Binder uiBinder = GWT.create(Binder.class);

  private final PatchSet.Id revision;
  private final String path;
  private DiffPreferences prefs;
  private CodeMirror cm;
  private String type;

  @UiField Element header;
  @UiField Element project;
  @UiField Element filePath;
  @UiField Button close;
  @UiField Button save;
  @UiField Element editor;

  private HandlerRegistration resizeHandler;
  private HandlerRegistration closeHandler;
  private int generation;

  public EditScreen(Patch.Key patch) {
    this.revision = patch.getParentKey();
    this.path = patch.get();
    prefs = DiffPreferences.create(Gerrit.getAccountDiffPreference());
    add(uiBinder.createAndBindUi(this));
    addDomHandler(GlobalKey.STOP_PROPAGATION, KeyPressEvent.getType());
  }

  @Override
  protected void onInitUI() {
    super.onInitUI();
    setHeaderVisible(false);
    setWindowTitle(FileInfo.getFileName(path));
  }

  @Override
  protected void onLoad() {
    super.onLoad();

    CallbackGroup cmGroup = new CallbackGroup();
    final CallbackGroup group = new CallbackGroup();
    CodeMirror.initLibrary(cmGroup.add(new AsyncCallback<Void>() {
      final AsyncCallback<Void> themeCallback = group.addEmpty();

      @Override
      public void onSuccess(Void result) {
        // Load theme after CM library to ensure theme can override CSS.
        ThemeLoader.loadTheme(prefs.theme(), themeCallback);
      }

      @Override
      public void onFailure(Throwable caught) {
      }
    }));

    if (prefs.syntaxHighlighting() && !Patch.COMMIT_MSG.equals(path)) {
      final AsyncCallback<Void> modeInjectorCb = group.addEmpty();
      ChangeFileApi.getContentType(revision, path,
          cmGroup.add(new GerritCallback<String>() {
            @Override
            public void onSuccess(String result) {
              ModeInfo mode = ModeInfo.findMode(result, path);
              type = mode != null ? mode.mime() : null;
              injectMode(result, modeInjectorCb);
            }
          }));
    }
    cmGroup.done();

    ChangeApi.detail(revision.getParentKey().get(),
        group.add(new GerritCallback<ChangeInfo>() {
          @Override
          public void onSuccess(ChangeInfo c) {
            project.setInnerText(c.project());
            SafeHtml.setInnerHTML(filePath, Header.formatPath(path, null, null));
          }
        }));

    ChangeFileApi.getContentOrMessage(revision, path,
        group.addFinal(new ScreenLoadCallback<String>(this) {
          @Override
          protected void preDisplay(String content) {
            initEditor(content);
          }
        }));
  }

  @Override
  public void onShowView() {
    super.onShowView();
    Window.enableScrolling(false);
    JumpKeys.enable(false);
    if (prefs.hideTopMenu()) {
      Gerrit.setHeaderVisible(false);
    }
    resizeHandler = Window.addResizeHandler(new ResizeHandler() {
      @Override
      public void onResize(ResizeEvent event) {
        cm.adjustHeight(header.getOffsetHeight());
      }
    });
    closeHandler = Window.addWindowClosingHandler(new ClosingHandler() {
      @Override
      public void onWindowClosing(ClosingEvent event) {
        if (!cm.isClean(generation)) {
          event.setMessage(EditConstants.I.closeUnsavedChanges());
        }
      }
    });

    generation = cm.changeGeneration(true);
    save.setEnabled(false);
    cm.on(new ChangesHandler() {
      @Override
      public void handle(CodeMirror cm) {
        save.setEnabled(!cm.isClean(generation));
      }
    });

    cm.adjustHeight(header.getOffsetHeight());
    cm.on("cursorActivity", updateCursorPosition());
    cm.extras().showTabs(prefs.showTabs());
    cm.extras().lineLength(prefs.lineLength());
    cm.refresh();
    cm.focus();
    updateActiveLine();
  }

  @Override
  protected void onUnload() {
    super.onUnload();
    if (cm != null) {
      cm.getWrapperElement().removeFromParent();
    }
    if (resizeHandler != null) {
      resizeHandler.removeHandler();
    }
    if (closeHandler != null) {
      closeHandler.removeHandler();
    }
    Window.enableScrolling(true);
    Gerrit.setHeaderVisible(true);
    JumpKeys.enable(true);
  }

  @UiHandler("save")
  void onSave(@SuppressWarnings("unused") ClickEvent e) {
    save().run();
  }

  @UiHandler("close")
  void onClose(@SuppressWarnings("unused") ClickEvent e) {
    if (cm.isClean(generation)
        || Window.confirm(EditConstants.I.cancelUnsavedChanges())) {
      upToChange();
    }
  }

  private void upToChange() {
    Gerrit.display(PageLinks.toChangeInEditMode(revision.getParentKey()));
  }

  private void initEditor(String content) {
    ModeInfo mode = prefs.syntaxHighlighting()
        ? ModeInfo.findMode(type, path)
        : null;
    cm = CodeMirror.create(editor, Configuration.create()
        .set("value", content)
        .set("readOnly", false)
        .set("cursorBlinkRate", 0)
        .set("cursorHeight", 0.85)
        .set("lineNumbers", true)
        .set("tabSize", prefs.tabSize())
        .set("lineWrapping", false)
        .set("scrollbarStyle", "overlay")
        .set("styleSelectedText", true)
        .set("showTrailingSpace", true)
        .set("keyMap", "default")
        .set("theme", prefs.theme().name().toLowerCase())
        .set("mode", mode != null ? mode.mode() : null));
    cm.addKeyMap(KeyMap.create()
        .on("Cmd-S", save())
        .on("Ctrl-S", save()));
  }

  private Runnable updateCursorPosition() {
    return new Runnable() {
      @Override
      public void run() {
        // The rendering of active lines has to be deferred. Reflow
        // caused by adding and removing styles chokes Firefox when arrow
        // key (or j/k) is held down. Performance on Chrome is fine
        // without the deferral.
        //
        Scheduler.get().scheduleDeferred(new ScheduledCommand() {
          @Override
          public void execute() {
            cm.operation(new Runnable() {
              @Override
              public void run() {
                updateActiveLine();
              }
            });
          }
        });
      }
    };
  }

  private void updateActiveLine() {
    Pos p = cm.getCursor("end");
    cm.extras().activeLine(cm.getLineHandleVisualStart(p.line()));
  }

  private Runnable save() {
    return new Runnable() {
      @Override
      public void run() {
        if (!cm.isClean(generation)) {
          String text = cm.getValue();
          final int g = cm.changeGeneration(false);
          ChangeFileApi.putContentOrMessage(revision, path, text,
              new GerritCallback<VoidResult>() {
                @Override
                public void onSuccess(VoidResult result) {
                  generation = g;
                  save.setEnabled(!cm.isClean(g));
                }
              });
        }
      }
    };
  }

  private void injectMode(String type, AsyncCallback<Void> cb) {
    new ModeInjector().add(type).inject(cb);
  }
}
